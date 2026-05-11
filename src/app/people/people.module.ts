import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { List as PeopleList } from './list/list';
import { Add as PeopleAdd } from './add/add';

const routes: Routes = [
  { path: '', component: PeopleList },
  { path: 'add', component: PeopleAdd }
];

@NgModule({
  imports: [PeopleList, PeopleAdd, CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class PeopleModule {}
