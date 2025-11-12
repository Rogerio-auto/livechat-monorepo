import { useState, useCallback } from "react";

export interface GeolocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface GeolocationError {
  code: number;
  message: string;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GeolocationError | null>(null);

  const reverseGeocode = async (lat: number, lon: number): Promise<Partial<GeolocationData>> => {
    try {
      // Usando Nominatim (OpenStreetMap) - gratuito, sem API key
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            "User-Agent": "LiveChat-CRM/1.0", // Nominatim exige User-Agent
          },
        }
      );

      if (!response.ok) {
        console.warn("[useGeolocation] Reverse geocoding failed");
        return {};
      }

      const data = await response.json();
      const addr = data.address || {};

      return {
        address: data.display_name || "",
        city: addr.city || addr.town || addr.village || addr.municipality || "",
        state: addr.state || "",
        postalCode: addr.postcode || "",
        country: addr.country || "Brasil",
      };
    } catch (e) {
      console.error("[useGeolocation] Reverse geocoding error:", e);
      return {};
    }
  };

  const getCurrentPosition = useCallback(async (): Promise<GeolocationData | null> => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      const err: GeolocationError = {
        code: 0,
        message: "Geolocalização não suportada neste navegador",
      };
      setError(err);
      setLoading(false);
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, altitude, accuracy } = position.coords;
          const timestamp = position.timestamp;

          // Busca endereço reverso
          const addressData = await reverseGeocode(latitude, longitude);

          const result: GeolocationData = {
            latitude,
            longitude,
            altitude,
            accuracy,
            timestamp,
            ...addressData,
          };

          setLoading(false);
          resolve(result);
        },
        (err) => {
          const errorData: GeolocationError = {
            code: err.code,
            message: err.message,
          };
          setError(errorData);
          setLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    getCurrentPosition,
    loading,
    error,
  };
}
