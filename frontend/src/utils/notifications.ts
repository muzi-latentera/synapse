import { isTauri } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { PermissionRequest } from '@/types/chat.types';
import { logger } from '@/utils/logger';

const NOTIFIED_PERMISSION_REQUESTS = new Set<string>();

function buildPermissionNotification(request: PermissionRequest): { title: string; body: string } {
  switch (request.tool_name) {
    case 'AskUserQuestion':
      return {
        title: 'Question needs your input',
        body: 'Answer the pending question to continue the task.',
      };
    case 'ExitPlanMode':
      return {
        title: 'Plan ready for approval',
        body: 'Review the plan and approve or reject it.',
      };
    default:
      return {
        title: 'Permission needed',
        body: `Tool "${request.tool_name}" is waiting for your approval.`,
      };
  }
}

async function sendWebNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

async function sendTauriNotification(title: string, body: string): Promise<void> {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === 'granted';
  }

  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

export async function notifyPermissionRequest(request: PermissionRequest): Promise<void> {
  if (NOTIFIED_PERMISSION_REQUESTS.has(request.request_id)) {
    return;
  }

  NOTIFIED_PERMISSION_REQUESTS.add(request.request_id);

  const { title, body } = buildPermissionNotification(request);

  try {
    if (isTauri()) {
      await sendTauriNotification(title, body);
      return;
    }

    await sendWebNotification(title, body);
  } catch (error) {
    logger.debug('Failed to send permission notification', 'notifications', error);
  }
}
