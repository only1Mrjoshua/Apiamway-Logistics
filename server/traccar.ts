/**
 * Traccar Cloud Integration Service
 * 
 * This module provides an abstracted interface to Traccar API.
 * Authentication is configurable via environment variables:
 * 
 * For Basic Auth (Demo/Self-hosted):
 *   TRACCAR_API_URL=https://demo.traccar.org/api
 *   TRACCAR_AUTH_TYPE=basic
 *   TRACCAR_USERNAME=your_email
 *   TRACCAR_PASSWORD=your_password
 * 
 * For API Token (Traccar Cloud):
 *   TRACCAR_API_URL=https://www.traccar.org/api
 *   TRACCAR_AUTH_TYPE=token
 *   TRACCAR_API_TOKEN=your_api_token
 * 
 * SECURITY NOTES:
 * - Credentials are NEVER exposed to frontend code
 * - Device IDs are mapped internally and never shown to customers
 * - All API calls are made server-side only
 */

// Environment variables are accessed via process.env

// Types for Traccar API responses
export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  disabled: boolean;
  lastUpdate: string | null;
  positionId: number | null;
  groupId: number | null;
  phone: string | null;
  model: string | null;
  contact: string | null;
  category: string | null;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string | null;
  accuracy: number;
  network: any | null;
  attributes: Record<string, any>;
}

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  devices?: CacheEntry<TraccarDevice[]>;
  positions: Map<number, CacheEntry<TraccarPosition>>;
} = {
  positions: new Map(),
};

// Cache TTL in milliseconds (30 seconds for positions, 5 minutes for devices)
const POSITION_CACHE_TTL = 30 * 1000;
const DEVICE_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get Traccar configuration from environment variables
 */
function getTraccarConfig() {
  const apiUrl = process.env.TRACCAR_API_URL || "https://demo.traccar.org/api";
  const authType = process.env.TRACCAR_AUTH_TYPE || "basic";
  const username = process.env.TRACCAR_USERNAME;
  const password = process.env.TRACCAR_PASSWORD;
  const apiToken = process.env.TRACCAR_API_TOKEN;
  
  return { apiUrl, authType, username, password, apiToken };
}

/**
 * Build authorization header based on auth type
 */
function getAuthHeader(): string {
  const config = getTraccarConfig();
  
  if (config.authType === "token" && config.apiToken) {
    return `Bearer ${config.apiToken}`;
  }
  
  if (config.authType === "basic" && config.username && config.password) {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    return `Basic ${credentials}`;
  }
  
  throw new Error("Traccar authentication not configured. Set TRACCAR_USERNAME/PASSWORD or TRACCAR_API_TOKEN.");
}

/**
 * Check if Traccar is configured
 */
export function isTraccarConfigured(): boolean {
  const config = getTraccarConfig();
  
  if (config.authType === "token") {
    return !!config.apiToken;
  }
  
  return !!(config.username && config.password);
}

/**
 * Make authenticated request to Traccar API
 */
async function traccarFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config = getTraccarConfig();
  const url = `${config.apiUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": getAuthHeader(),
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Traccar API error: ${response.status} - ${errorText}`);
    throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get all devices from Traccar
 * Results are cached for 5 minutes
 */
export async function getDevices(): Promise<TraccarDevice[]> {
  // Check cache
  if (cache.devices && Date.now() - cache.devices.timestamp < DEVICE_CACHE_TTL) {
    return cache.devices.data;
  }
  
  const devices = await traccarFetch<TraccarDevice[]>("/devices");
  
  // Update cache
  cache.devices = {
    data: devices,
    timestamp: Date.now(),
  };
  
  return devices;
}

/**
 * Get a specific device by Traccar device ID
 */
export async function getDeviceById(traccarDeviceId: number): Promise<TraccarDevice | null> {
  const devices = await getDevices();
  return devices.find(d => d.id === traccarDeviceId) || null;
}

/**
 * Get latest positions for all devices
 */
export async function getAllPositions(): Promise<TraccarPosition[]> {
  return traccarFetch<TraccarPosition[]>("/positions");
}

/**
 * Get latest position for a specific device
 * Results are cached for 30 seconds
 */
export async function getDevicePosition(traccarDeviceId: number): Promise<TraccarPosition | null> {
  // Check cache
  const cached = cache.positions.get(traccarDeviceId);
  if (cached && Date.now() - cached.timestamp < POSITION_CACHE_TTL) {
    return cached.data;
  }
  
  // Fetch all positions and find the one for this device
  const positions = await getAllPositions();
  const position = positions.find(p => p.deviceId === traccarDeviceId);
  
  if (position) {
    // Update cache
    cache.positions.set(traccarDeviceId, {
      data: position,
      timestamp: Date.now(),
    });
  }
  
  return position || null;
}

/**
 * Get device with its latest position
 */
export async function getDeviceWithPosition(traccarDeviceId: number): Promise<{
  device: TraccarDevice | null;
  position: TraccarPosition | null;
  lastUpdate: Date | null;
}> {
  const [device, position] = await Promise.all([
    getDeviceById(traccarDeviceId),
    getDevicePosition(traccarDeviceId),
  ]);
  
  return {
    device,
    position,
    lastUpdate: device?.lastUpdate ? new Date(device.lastUpdate) : null,
  };
}

/**
 * Clear all caches (useful for testing or forced refresh)
 */
export function clearCache(): void {
  cache.devices = undefined;
  cache.positions.clear();
}

/**
 * Get tracking data for public tracking page
 * This returns sanitized data safe for public consumption
 * NEVER exposes raw Traccar device IDs to customers
 */
export async function getPublicTrackingData(traccarDeviceId: number): Promise<{
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  lastUpdate: Date | null;
  address: string | null;
} | null> {
  try {
    const { device, position, lastUpdate } = await getDeviceWithPosition(traccarDeviceId);
    
    if (!device || !position) {
      return null;
    }
    
    // Check if device is online (updated within last 5 minutes)
    const isOnline = lastUpdate ? (Date.now() - lastUpdate.getTime()) < 5 * 60 * 1000 : false;
    
    return {
      isOnline,
      latitude: position.valid ? position.latitude : null,
      longitude: position.valid ? position.longitude : null,
      speed: position.valid ? position.speed : null,
      lastUpdate,
      address: position.address,
    };
  } catch (error) {
    console.error("Error fetching tracking data:", error);
    return null;
  }
}

/**
 * Health check for Traccar connection
 */
export async function checkTraccarHealth(): Promise<{
  connected: boolean;
  deviceCount: number;
  error?: string;
}> {
  try {
    if (!isTraccarConfigured()) {
      return {
        connected: false,
        deviceCount: 0,
        error: "Traccar not configured",
      };
    }
    
    const devices = await getDevices();
    return {
      connected: true,
      deviceCount: devices.length,
    };
  } catch (error) {
    return {
      connected: false,
      deviceCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
