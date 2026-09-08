import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith("http")
);

// Fallback dummy client if credentials aren't set yet to avoid runtime crashes
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        signUp: async ({ email, password }) => {
          // Local storage fallback mock
          const mockUser = { id: `local-${Date.now()}`, email };
          localStorage.setItem("floodcast_local_user", JSON.stringify(mockUser));
          return { data: { user: mockUser }, error: null };
        },
        signInWithPassword: async ({ email, password }) => {
          const stored = localStorage.getItem("floodcast_local_user");
          const user = stored ? JSON.parse(stored) : { id: `local-1`, email };
          return { data: { user }, error: null };
        },
        signOut: async () => {
          localStorage.removeItem("floodcast_local_user");
          return { error: null };
        },
        getUser: async () => {
          if (typeof window === "undefined") return { data: { user: null }, error: null };
          const stored = localStorage.getItem("floodcast_local_user");
          return { data: { user: stored ? JSON.parse(stored) : null }, error: null };
        },
        getSession: async () => {
          if (typeof window === "undefined") return { data: { session: null }, error: null };
          const stored = localStorage.getItem("floodcast_local_user");
          return { data: { session: stored ? { user: JSON.parse(stored) } : null }, error: null };
        },
        onAuthStateChange: (callback) => {
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            execute: async () => ({ data: [], error: null }),
          }),
        }),
        insert: () => ({
          execute: async () => ({ data: [], error: null }),
        }),
      }),
    };

// Auth helper utilities
export async function signUpWithEmail(email, password, fullName = "") {
  try {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return res;
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signInWithEmail(email, password) {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signOutUser() {
  try {
    const res = await supabase.auth.signOut();
    return res;
  } catch (err) {
    return { error: err };
  }
}

export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch (err) {
    return null;
  }
}

export async function saveUserLocation(userId, nameOrData, lat, lng) {
  let locData = {};
  if (typeof nameOrData === "object" && nameOrData !== null) {
    locData = nameOrData;
  } else {
    locData = {
      location_name: nameOrData,
      latitude: lat,
      longitude: lng,
    };
  }

  if (!isSupabaseConfigured) {
    const existing = JSON.parse(localStorage.getItem(`floodcast_saved_locs_${userId}`) || "[]");
    const newLoc = { id: `loc-${Date.now()}`, ...locData, created_at: new Date().toISOString() };
    existing.push(newLoc);
    localStorage.setItem(`floodcast_saved_locs_${userId}`, JSON.stringify(existing));
    return { data: newLoc, error: null };
  }

  try {
    const { data, error } = await supabase
      .from("user_saved_locations")
      .insert({ user_id: userId, ...locData })
      .select();
    return { data: data?.[0] || null, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function getUserSavedLocations(userId) {
  if (!isSupabaseConfigured) {
    const existing = JSON.parse(localStorage.getItem(`floodcast_saved_locs_${userId}`) || "[]");
    return existing;
  }

  try {
    const { data, error } = await supabase
      .from("user_saved_locations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function removeUserLocation(locationId) {
  if (!isSupabaseConfigured) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("floodcast_saved_locs_")) {
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = existing.filter((item) => item.id !== locationId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from("user_saved_locations")
      .delete()
      .eq("id", locationId);
    return { success: !error, error };
  } catch (err) {
    return { success: false, error: err };
  }
}

export const deleteUserLocation = removeUserLocation;

