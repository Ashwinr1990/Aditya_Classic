import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Overview } from './dashboard/overview/overview';
import { AuthService } from './services/auth.service';

// Guests only see the dashboard. Before login nothing renders, so let the route through;
// the login screen sends guests back to the dashboard afterwards.
const adminOnly: CanActivateFn = () => {
	const auth = inject(AuthService);
	return !auth.loggedIn() || auth.canEdit() || inject(Router).parseUrl('/');
};

export const routes: Routes = [
	{ path: '', component: Overview },
	{
		path: 'people',
		canActivate: [adminOnly],
		loadChildren: () => import('./people/people.module').then(m => m.PeopleModule)
	},
	{
		path: 'maintenance',
		canActivate: [adminOnly],
		loadChildren: () => import('./maintenance/maintenance.module').then(m => m.MaintenanceModule)
	},
	{
		path: 'utilities',
		canActivate: [adminOnly],
		loadChildren: () => import('./utilities/utilities.module').then(m => m.UtilitiesModule)
	},
	{
		path: 'security',
		canActivate: [adminOnly],
		loadChildren: () => import('./security/security.module').then(m => m.SecurityModule)
	},
	{
		path: 'common-maintenance',
		canActivate: [adminOnly],
		loadChildren: () => import('./common-maintenance/common-maintenance.module').then(m => m.CommonMaintenanceModule)
	}
];
