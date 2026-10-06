/// <reference lib="webworker" />
// Point d'entrée du Web Worker : la simulation tourne ici, loin du rendu.
import { SimulationHost } from './host';
import type { MainToWorker, WorkerToMain } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

/** Intervalle de la boucle du worker (ms). À x4, un tick dure environ 67 ms. */
const FRAME_MS = 16;

const host = new SimulationHost(
  (message: WorkerToMain) => self.postMessage(message),
  () => performance.now(),
);

self.onmessage = (event: MessageEvent<MainToWorker>) => host.handle(event.data);
setInterval(() => host.frame(), FRAME_MS);
