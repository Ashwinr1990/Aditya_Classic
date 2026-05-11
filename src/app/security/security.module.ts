import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { List as SecurityList } from './list/list';
import { Add as SecurityAdd } from './add/add';

const routes: Routes = [
  { path: '', component: SecurityList },
  { path: 'add', component: SecurityAdd }
];

@NgModule({
  imports: [SecurityList, SecurityAdd, CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class SecurityModule {}
