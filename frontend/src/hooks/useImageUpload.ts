import { useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface PhotoMetadata {
  latitude?: number;
  longitude?: number;
  altitude?: number | null;
  accuracy?: number;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  capturedAt?: string;
  deviceInfo?: string;
}

export interface UploadedPhoto {
  id: string;
  storage_url: string;
  storage_path: string;
  metadata: PhotoMetadata;
  created_at: string;
}

export function useImageUpload(cardId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = useCallback(
    async (imageData: string, metadata: PhotoMetadata): Promise<UploadedPhoto | null> => {
      setUploading(true);
      setError(null);
      setProgress({ loaded: 0, total: 100, percentage: 0 });

      try {
        const response = await fetch(`${API}/kanban/cards/${cardId}/photos`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageData,
            metadata: {
              ...metadata,
              capturedAt: new Date().toISOString(),
              deviceInfo: navigator.userAgent,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }

        const result = await response.json();
        setProgress({ loaded: 100, total: 100, percentage: 100 });
        setUploading(false);

        return result as UploadedPhoto;
      } catch (e: any) {
        console.error("[useImageUpload] Upload error:", e);
        setError(e.message || "Failed to upload photo");
        setUploading(false);
        setProgress(null);
        return null;
      }
    },
    [cardId]
  );

  const fetchPhotos = useCallback(async (): Promise<UploadedPhoto[]> => {
    try {
      const response = await fetch(`${API}/kanban/cards/${cardId}/photos`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.status}`);
      }

      const photos = await response.json();
      return photos;
    } catch (e: any) {
      console.error("[useImageUpload] Fetch error:", e);
      setError(e.message || "Failed to fetch photos");
      return [];
    }
  }, [cardId]);

  const deletePhoto = useCallback(async (photoId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API}/kanban/photos/${photoId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      return true;
    } catch (e: any) {
      console.error("[useImageUpload] Delete error:", e);
      setError(e.message || "Failed to delete photo");
      return false;
    }
  }, []);

  return {
    uploadPhoto,
    fetchPhotos,
    deletePhoto,
    uploading,
    progress,
    error,
  };
}
