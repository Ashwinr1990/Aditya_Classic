import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../services/toast.service';
import { ADMIN_PROFILE_KEY, AuthService } from '../services/auth.service';
import { CloudSyncService, DATA_KEYS, NESTED_KEYS } from '../services/cloud-sync.service';
import { LanguageService } from '../i18n/language.service';
import { TranslatePipe } from '../i18n/translate.pipe';

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

// Columns shown in the current language: people's names, text someone typed, and words the app knows.
// Everything else (amounts, dates, emails, house numbers) is shown as stored.
const NAME_COLUMNS: Record<string, string> = { people: 'name', guards: 'name', maintenanceData: 'person', salaryData: 'guard' };
const TEXT_COLUMNS: Record<string, string> = { miscellaneous: 'name', commonItems: 'desc' };
const WORD_COLUMNS: Record<string, string> = { utilityData: 'type' };

/** Every data sheet kept in the cloud workbook, as raw tables the admin can edit or delete rows from. */
@Component({
  selector: 'app-all-data',
  imports: [FormsModule, TranslatePipe],
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
  // Kannada spellings saved on the People and Guards sheets, for the name columns of the payment sheets
  private peopleKn = new Map<string, string>();
  private guardsKn = new Map<string, string>();

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
    // Matches what is stored or what is shown, so a Kannada name can be searched in Kannada
    const matches = (row: Row, c: string) => [row[c], this.shown(row, c)].some(v => String(v ?? '').toLowerCase().includes(q));
    return this.rows()
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !q || (col ? [col] : Object.keys(row)).some(c => matches(row, c)));
  });

  /** True when every row matching the search is ticked. */
  readonly allVisibleSelected = computed(() => {
    const visible = this.visible();
    return visible.length > 0 && visible.every(({ index }) => this.selected().has(index));
  });

  constructor(
    public auth: AuthService,
    private cloudSync: CloudSyncService,
    private toast: ToastService,
    private i18n: LanguageService,
  ) {
    this.load();
  }

  /** A cell as shown: names and typed text in the current language, everything else as stored. */
  shown(row: Row, c: string): string {
    const value = String(row[c] ?? '');
    const key = this.key();
    if (NAME_COLUMNS[key] === c) {
      const saved =
        key === 'maintenanceData' ? this.peopleKn.get(value) : key === 'salaryData' ? this.guardsKn.get(value) : row['nameKn'];
      return this.i18n.name(value, saved);
    }
    if (TEXT_COLUMNS[key] === c) return this.i18n.text(value, row['descKn']);
    if (WORD_COLUMNS[key] === c) return this.i18n.t(value);
    return value;
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
    if (ok) this.toast.showToast(this.i18n.t('Loaded the latest data from the cloud'), 4000, 'success');
    else this.toast.showToast(this.i18n.t('Could not reach the cloud; showing data saved on this device'), 6000, 'error');
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
        if (nested) return this.error.set(this.i18n.t('{column} cannot be empty.', { column: this.i18n.t(c) }));
        continue;
      }
      // Keep numbers as numbers, so totals and reports still add them up.
      const numeric = nested ? c === 'amount' || c === 'month' : typeof original[c] === 'number';
      if (!numeric) {
        row[c] = value;
        continue;
      }
      if (!Number.isFinite(Number(value))) return this.error.set(this.i18n.t('{column} must be a number.', { column: this.i18n.t(c) }));
      row[c] = Number(value);
    }
    if (nested) {
      if (!/^\d{4}$/.test(row['year'])) {
        return this.error.set(this.i18n.t('{column} must be 4 digits, e.g. 2026.', { column: this.i18n.t('year') }));
      }
      if (!Number.isInteger(row['month']) || row['month'] < 1 || row['month'] > 12) {
        return this.error.set(this.i18n.t('{column} must be 1 to 12.', { column: this.i18n.t('month') }));
      }
      row['month'] = String(row['month']).padStart(2, '0');
    }
    const rows = [...this.rows()];
    rows[index] = row;
    this.write(rows, this.i18n.t('Row updated'));
    this.editIndex.set(null);
  }

  deleteRow(index: number) {
    const summary = this.columns()
      .map(c => this.rows()[index][c])
      .filter(v => v != null && v !== '')
      .join(' · ');
    const question = this.i18n.t('Delete this {label} row?', { label: this.label() });
    if (!window.confirm(`${question}\n\n${summary}\n\n${this.i18n.t('This cannot be undone.')}`)) return;
    const rows = this.rows().filter((_, i) => i !== index);
    if (this.editIndex() !== null) this.cancelEdit();
    this.write(rows, this.i18n.t('Row deleted'));
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
    const question = this.i18n.t(count === 1 ? 'Delete {count} {label} row?' : 'Delete {count} {label} rows?', {
      count,
      label: this.label(),
    });
    if (!window.confirm(`${question}\n\n${this.i18n.t('This cannot be undone.')}`)) return;
    const rows = this.rows().filter((_, i) => !this.selected().has(i));
    this.write(rows, this.i18n.t(count === 1 ? '{count} row deleted' : '{count} rows deleted', { count }));
  }

  /** The current sheet's name, in the current language. */
  private label() {
    return this.i18n.t(this.labels[this.key()] || this.key());
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
    const kannadaNames = (key: string) =>
      new Map<string, string>(this.cloudSync.sheetRows(key).filter(r => r.nameKn).map(r => [r.name, r.nameKn]));
    this.peopleKn = kannadaNames('people');
    this.guardsKn = kannadaNames('guards');
  }
}
