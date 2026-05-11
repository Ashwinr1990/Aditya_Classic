import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { List as CommonMaintenanceList } from './list/list';
import { Add as CommonMaintenanceAdd } from './add/add';

const routes: Routes = [
  { path: '', component: CommonMaintenanceList },
  { path: 'add', component: CommonMaintenanceAdd }
];

@NgModule({
  imports: [CommonMaintenanceList, CommonMaintenanceAdd, CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class CommonMaintenanceModule {}
