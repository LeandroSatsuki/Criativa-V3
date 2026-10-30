export const PHOTO_PREVIEW_PAGE_SIZE = 6;

export const getPhotoPreviewPage = <T>(
  photos: T[],
  requestedPage: number,
  pageSize = PHOTO_PREVIEW_PAGE_SIZE,
) => {
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : PHOTO_PREVIEW_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(photos.length / safePageSize));
  const normalizedPage = Number.isInteger(requestedPage) ? requestedPage : totalPages - 1;
  const page = Math.max(0, Math.min(normalizedPage, totalPages - 1));
  const start = page * safePageSize;

  return {
    page,
    totalPages,
    items: photos.slice(start, start + safePageSize).map((photo, index) => ({
      photo,
      originalIndex: start + index,
    })),
  };
};
