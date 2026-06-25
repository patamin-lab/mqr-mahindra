'use client';

import Swal, { SweetAlertIcon } from 'sweetalert2';

const baseConfig = {
  customClass: {
    popup: 'mqr-swal',
  },
  buttonsStyling: false,
  confirmButtonText: 'ตกลง',
};

export function swalSuccess(message: string, title = 'สำเร็จ') {
  return Swal.fire({ ...baseConfig, icon: 'success' as SweetAlertIcon, title, text: message });
}

export function swalError(message: string, title = 'เกิดข้อผิดพลาด') {
  return Swal.fire({ ...baseConfig, icon: 'error' as SweetAlertIcon, title, text: message });
}

export function swalInfo(message: string, title = 'แจ้งเตือน') {
  return Swal.fire({ ...baseConfig, icon: 'info' as SweetAlertIcon, title, text: message });
}

export async function swalConfirm(
  message: string,
  opts?: { title?: string; confirmText?: string; cancelText?: string }
): Promise<boolean> {
  const result = await Swal.fire({
    ...baseConfig,
    icon: 'warning' as SweetAlertIcon,
    title: opts?.title ?? 'ยืนยันการดำเนินการ',
    text: message,
    showCancelButton: true,
    confirmButtonText: opts?.confirmText ?? 'ยืนยัน',
    cancelButtonText: opts?.cancelText ?? 'ยกเลิก',
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

export async function swalPrompt(
  message: string,
  opts?: { title?: string; inputType?: 'text' | 'password'; placeholder?: string }
): Promise<string | null> {
  const result = await Swal.fire({
    ...baseConfig,
    title: opts?.title ?? message,
    input: opts?.inputType ?? 'text',
    inputPlaceholder: opts?.placeholder,
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    inputValidator: (value: string) => (!value ? 'กรุณากรอกข้อมูล' : null),
  });
  return result.isConfirmed ? (result.value as string) : null;
}

/**
 * Non-dismissable "working..." popup with a spinner, used for any
 * save/upload/login action so the user always sees that a button press did
 * something - per the standing request that *every* button press should
 * give visible feedback. Call `swalUpdateLoading` to change the message as
 * a multi-step operation (e.g. uploading several files) progresses, and
 * `swalClose` when it's done (success or failure - the caller is
 * responsible for then showing `swalSuccess`/`swalError`).
 */
export function swalLoading(message = 'กำลังดำเนินการ...') {
  Swal.fire({
    ...baseConfig,
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

export function swalUpdateLoading(message: string) {
  if (Swal.isVisible()) {
    Swal.update({ title: message });
  } else {
    swalLoading(message);
  }
}

export function swalClose() {
  Swal.close();
}
