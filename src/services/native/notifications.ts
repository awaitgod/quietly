import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { isTauri } from './environment';
export async function tauriNotify(title: string, body: string): Promise<void> {
    if (!isTauri())
        return;
    try {
        let hasPerm = await isPermissionGranted();
        if (!hasPerm) {
            const permission = await requestPermission();
            hasPerm = permission === 'granted';
        }
        if (hasPerm) {
            sendNotification({ title, body });
        }
    }
    catch (err) {
        console.warn('[Tauri IPC] sendNotification error:', err);
    }
}
