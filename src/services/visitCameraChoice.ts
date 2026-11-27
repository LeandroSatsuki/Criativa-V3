export type CameraChoice = 'auto' | 'lite' | 'native';
const key = (owner: string) => 'criativa_visit_camera_v1:' + encodeURIComponent(owner);

export function cameraChoice(owner: string): CameraChoice {
  try {
    const choice = owner && sessionStorage.getItem(key(owner));
    return choice === 'lite' || choice === 'native' ? choice : 'auto';
  } catch { return 'auto'; }
}

export function setCameraChoice(owner: string, choice: CameraChoice) {
  if (!owner) return;
  try {
    if (choice === 'auto') sessionStorage.removeItem(key(owner));
    else sessionStorage.setItem(key(owner), choice);
  } catch { /* A storage restriction must never prevent capture. */ }
}

export const supportsVisitCamera = () => /Android/i.test(navigator.userAgent) &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof HTMLDialogElement !== 'undefined' &&
  typeof HTMLDialogElement.prototype.showModal === 'function';
