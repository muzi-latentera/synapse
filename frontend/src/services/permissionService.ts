import { apiClient } from '@/lib/api';
import { serviceCall } from '@/services/base/BaseService';
import { validateId } from '@/utils/validation';

async function respondToPermission(
  chatId: string,
  requestId: string,
  optionId: string,
  alternativeInstruction?: string,
): Promise<void> {
  validateId(chatId, 'Chat ID');
  validateId(requestId, 'Request ID');

  return serviceCall(async () => {
    const formData = new FormData();
    formData.append('option_id', optionId);
    if (alternativeInstruction) {
      formData.append('alternative_instruction', alternativeInstruction);
    }

    await apiClient.postForm(`/chat/chats/${chatId}/permissions/${requestId}/respond`, formData);
  });
}

async function respondWithAnswers(
  chatId: string,
  requestId: string,
  optionId: string,
  answers: Record<string, string | string[]>,
): Promise<void> {
  validateId(chatId, 'Chat ID');
  validateId(requestId, 'Request ID');

  return serviceCall(async () => {
    const formData = new FormData();
    formData.append('option_id', optionId);
    formData.append('user_answers', JSON.stringify(answers));

    await apiClient.postForm(`/chat/chats/${chatId}/permissions/${requestId}/respond`, formData);
  });
}

export const permissionService = {
  respondToPermission,
  respondWithAnswers,
};
