#!/usr/bin/env python3
"""Manually generate static game pages from data/games.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from site_generator import generate_game_page, sync_index, normalize_all

DATA_FILE = ROOT / 'data' / 'games.json'
GAMES_DIR = ROOT / 'games'

def main():
    if not DATA_FILE.exists():
        print(f"Error: {DATA_FILE} not found")
        sys.exit(1)
    
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data = normalize_all(data)
    games = data.get('games', [])
    active = [g for g in games if g.get('active') is not False]
    valid_slugs = {g.get('slug') for g in games if g.get('slug')}
    
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"Generating {len(active)} game pages...")
    
    for game in active:
        slug = game.get('slug')
        if not slug:
            continue
        path = GAMES_DIR / f'{slug}.html'
        path.write_text(generate_game_page(game, games), encoding='utf-8')
        print(f"  Generated: {slug}.html")
    
    # Remove deleted game pages
    for fp in GAMES_DIR.glob('*.html'):
        if fp.stem not in valid_slugs:
            fp.unlink()
            print(f"  Removed: {fp.name}")
    
    # Update homepage
    print("Updating homepage...")
    sync_index(data)
    
    print("\nDone! Static pages generated from data/games.json")

if __name__ == '__main__':
    main()
