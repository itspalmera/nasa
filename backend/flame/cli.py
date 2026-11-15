import argparse
import json
from .config import settings
from .store import Store
from .ingest import ingest

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FLAME local corpus indexing; no paid calls unless explicitly enabled')
    parser.add_argument('command', choices=['ingest', 'inventory', 'connections'])
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--embeddings', action='store_true')
    parser.add_argument('--force-embeddings', action='store_true')
    args = parser.parse_args()
    store = Store(settings())
    if args.command == 'ingest':
        print(ingest(store, args.dry_run, args.embeddings, args.force_embeddings).model_dump_json(indent=2))
    elif args.command == 'connections':
        cfg = store.config
        print(json.dumps({
            'openai': {'model': cfg.openai_model,
                       'embedding_model': cfg.openai_embedding_model,
                       'key_configured': bool(cfg.openai_api_key),
                       'paid_api_enabled': cfg.enable_paid_api,
                       'status': 'configured_not_verified' if cfg.enable_paid_api and cfg.openai_api_key else 'disabled'},
            'synthesis': {'provider': cfg.llm_provider, 'model': cfg.synthesis_model,
                          'anthropic_key_configured': bool(cfg.anthropic_api_key),
                          'status': 'configured_not_verified' if cfg.synthesis_ready else 'disabled'},
            'consensus': {'status': 'manual_import_only',
                          'api_key_configured': bool(cfg.consensus_api_key),
                          'api_key_used': False,
                          'import_endpoint': '/api/discovery/upload'},
        }, indent=2))
    else:
        from .inventory import write_inventory
        write_inventory(store)
