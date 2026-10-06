// Les threads Node n'héritent pas du chargeur TypeScript : on enregistre tsx avant de
// charger le vrai worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
