import type { Role } from '../../../src/types';

type SupervisorIdentity = {
  role: Role;
};

export type SupervisorAccessError = {
  status: 401 | 403;
  message: string;
};

export const getSupervisorAccessError = (
  identity: SupervisorIdentity | null,
): SupervisorAccessError | null => {
  if (!identity) {
    return {
      status: 401,
      message: 'Sessão inválida ou expirada. Faça login novamente.',
    };
  }

  if (identity.role !== 'SUPERVISOR') {
    return {
      status: 403,
      message: 'Acesso restrito ao supervisor',
    };
  }

  return null;
};
