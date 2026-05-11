import { Routes } from '@angular/router';
import { Overview } from './dashboard/overview/overview';

export const routes: Routes = [
	{ path: '', component: Overview },
	{
		path: 'people',
		loadChildren: () => import('./people/people.module').then(m => m.PeopleModule)
	},
	{
		path: 'maintenance',
		loadChildren: () => import('./maintenance/maintenance.module').then(m => m.MaintenanceModule)
	},
	{
		path: 'utilities',
		loadChildren: () => import('./utilities/utilities.module').then(m => m.UtilitiesModule)
	},
	{
		path: 'security',
		loadChildren: () => import('./security/security.module').then(m => m.SecurityModule)
	},
	{
		path: 'common-maintenance',
		loadChildren: () => import('./common-maintenance/common-maintenance.module').then(m => m.CommonMaintenanceModule)
	}
];
