from supabase import Client, create_client


def build_supabase_client(url: str, key: str) -> Client:
    return create_client(url, key)
