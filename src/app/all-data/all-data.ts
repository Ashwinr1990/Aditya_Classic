import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { ADMIN_PROFILE_KEY, AuthService } from '../services/auth.service';
import { CloudSyncService, DATA_KEYS, NESTED_KEYS } from '../services/cloud-sync.service';

type Row = Record<string, any>;

const LABELS: Record<string, string> = {
  people: 'People',
  maintenanceData: 'Maintenance',
  utilityData: 'Utilities',
  miscellaneous: 'Miscellaneous',
  guards: 'Security Guards',
  salaryData: 'Security Salary',
  commonItems: 'Common Maintenance',
  [ADMIN_PROFILE_KEY]: 'Admin Profile',
};

// Things the raw data does not make obvious.
const NOTES: Record<string, string> = {
  people: 'Maintenance amounts are linked by name: renaming or deleting a person here does not change their Maintenance rows.',
  guards: 'Salaries are linked by name: renaming or deleting a guard here does not change their Security Salary rows.',
  commonItems: 'month is counted from 0: 0 = January … 11 = December.',
};

/** Every data sheet kept in the cloud workbook, as raw tables the admin can edit or delete rows from. */
@Component({
  selector: 'app-all-data',
  imports: [FormsModule],
  templateUrl: './all-data.html',
  styleUrl: './all-data.scss',
})
export class AllData {
  readonly keys = DATA_KEYS;
  readonly labels = LABELS;
  readonly notes = NOTES;

  readonly key = signal(DATA_KEYS[0]);
  readonly rows = signal<Row[]>([]);
  readonly counts = signal<Record<string, number>>({});
  readonly search = signal('');
  // Column the search looks in; '' searches every column
  readonly searchColumn = signal('');
  readonly editIndex = signal<number | null>(null);
  readonly error = signal('');
  readonly reloading = signal(false);
  // Indexes in `rows` ticked for deleting together
  readonly selected = signal<Set<number>>(new Set());
  // Values of the row being edited, as typed
  draft: Record<string, string> = {};

  /** Columns in order of first appearance; nested sheets always have the same four. */
  readonly columns = computed(() => {
    const col = NESTED_KEYS[this.key()];
    if (col) return ['year', col, 'month', 'amount'];
    const cols: string[] = [];
    for (const row of this.rows()) for (const c of Object.keys(row)) if (!cols.includes(c)) cols.push(c);
    return cols;
  });

  /** Rows matching the search in the chosen column (or any column), with their index in `rows`. */
  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const col = this.searchColumn();
    const matches = (v: any) => String(v ?? '').toLowerCase().includes(q);
    return this.rows()
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !q || (col ? matches(row[col]) : Object.values(row).some(matches)));
  });

  /** True when every row matching the search is ticked. */
  readonly allVisibleSelected = computed(() => {
    const visible = this.visible();
    return visible.length > 0 && visible.every(({ index }) => this.selected().has(index));
  });

  constructor(public auth: AuthService, private cloudSync: CloudSyncService, private toast: ToastService) {
    this.load();
  }

  select(key: string) {
    this.key.set(key);
    this.search.set('');
    this.searchColumn.set('');
    this.load();
  }

  async reloadFromCloud() {
    this.reloading.set(true);
    const ok = await this.cloudSync.reload();
    this.reloading.set(false);
    this.load();
    if (ok) this.toast.showToast('Loaded the latest data from the cloud', 4000, 'success');
    else this.toast.showToast('Could not reach the cloud; showing data saved on this device', 6000, 'error');
  }

  startEdit(index: number) {
    const row = this.rows()[index];
    this.draft = Object.fromEntries(this.columns().map(c => [c, row[c] == null ? '' : String(row[c])]));
    this.error.set('');
    this.editIndex.set(index);
  }

  cancelEdit() {
    this.editIndex.set(null);
    this.error.set('');
  }

  saveEdit() {
    const index = this.editIndex();
    if (index === null) return;
    const original = this.rows()[index];
    const nested = !!NESTED_KEYS[this.key()];
    const row: Row = {};
    for (const c of this.columns()) {
      const value = (this.draft[c] ?? '').trim();
      if (value === '') {
        if (nested) return this.error.set(`${c} cannot be empty.`);
        continue;
      }
      // Keep numbers as numbers, so totals and reports still add them up.
      const numeric = nested ? c === 'amount' || c === 'month' : typeof original[c] === 'number';
      if (!numeric) {
        row[c] = value;
        continue;
      }
      if (!Number.isFinite(Number(value))) return this.error.set(`${c} must be a number.`);
      row[c] = Number(value);
    }
    if (nested) {
      if (!/^\d{4}$/.test(row['year'])) return this.error.set('year must be 4 digits, e.g. 2026.');
      if (!Number.isInteger(row['month']) || row['month'] < 1 || row['month'] > 12) {
        return this.error.set('month must be 1 to 12.');
      }
      row['month'] = String(row['month']).padStart(2, '0');
    }
    const rows = [...this.rows()];
    rows[index] = row;
    this.write(rows, 'Row updated');
    this.editIndex.set(null);
  }

  deleteRow(index: number) {
    const summary = this.columns()
      .map(c => this.rows()[index][c])
      .filter(v => v != null && v !== '')
      .join(' · ');
    if (!window.confirm(`Delete this ${this.labels[this.key()]} row?\n\n${summary}\n\nThis cannot be undone.`)) return;
    const rows = this.rows().filter((_, i) => i !== index);
    if (this.editIndex() !== null) this.cancelEdit();
    this.write(rows, 'Row deleted');
  }

  toggleRow(index: number) {
    const selected = new Set(this.selected());
    if (!selected.delete(index)) selected.add(index);
    this.selected.set(selected);
  }

  /** Ticks or unticks every row matching the search, leaving hidden rows as they are. */
  toggleAllVisible() {
    const selected = new Set(this.selected());
    const tick = !this.allVisibleSelected();
    for (const { index } of this.visible()) {
      if (tick) selected.add(index);
      else selected.delete(index);
    }
    this.selected.set(selected);
  }

  clearSelection() {
    this.selected.set(new Set());
  }

  deleteSelected() {
    const count = this.selected().size;
    if (!count) return;
    const label = this.labels[this.key()] || this.key();
    if (!window.confirm(`Delete ${count} ${label} row${count === 1 ? '' : 's'}?

This cannot be undone.`)) return;
    const rows = this.rows().filter((_, i) => !this.selected().has(i));
    this.write(rows, `${count} row${count === 1 ? '' : 's'} deleted`);
  }

  private write(rows: Row[], message: string) {
    this.cloudSync.setSheetRows(this.key(), rows);
    if (this.key() === ADMIN_PROFILE_KEY) this.auth.loadAdminEmail();
    this.load();
    this.toast.showToast(message, 4000, 'success');
  }

  private load() {
    this.editIndex.set(null);
    this.clearSelection();
    this.rows.set(this.cloudSync.sheetRows(this.key()));
    this.counts.set(Object.fromEntries(DATA_KEYS.map(k => [k, this.cloudSync.sheetRows(k).length])));
  }
}
