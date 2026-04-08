import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { createUserProfile,
    changePassword,
    verifyResetCode,
    sendResetCode, 
    completeProfile, 
    validateSignup, 
    checkAuthorizedUser, 
    sendVerificationCode, 
    verifyVerificationCode, 
    resendVerificationCode} from './auth';
export { generateUserId } from './utils';

