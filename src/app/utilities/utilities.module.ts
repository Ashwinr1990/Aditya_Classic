import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { List as UtilitiesList } from './list/list';
import { Add as UtilitiesAdd } from './add/add';

const routes: Routes = [
  { path: '', component: UtilitiesList },
  { path: 'add', component: UtilitiesAdd }
];

@NgModule({
  imports: [UtilitiesList, UtilitiesAdd, CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class UtilitiesModule {}
