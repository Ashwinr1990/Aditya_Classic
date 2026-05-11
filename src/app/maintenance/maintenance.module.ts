import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { List as MaintenanceList } from './list/list';
import { Add as MaintenanceAdd } from './add/add';

const routes: Routes = [
  { path: '', component: MaintenanceList },
  { path: 'add', component: MaintenanceAdd }
];

@NgModule({
  imports: [MaintenanceList, MaintenanceAdd, CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class MaintenanceModule {}
