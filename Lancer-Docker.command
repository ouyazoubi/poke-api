#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker Desktop doit être installé pour ce lancement.'
  read '?Appuyez sur Entrée pour fermer.'
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo 'Démarrage de Docker Desktop…'
  open -a Docker || exit 1
  poke_ready=0
  for poke_attempt in {1..45}; do
    if docker info >/dev/null 2>&1; then poke_ready=1; break; fi
    sleep 2
  done
  if [ "$poke_ready" -ne 1 ]; then
    echo 'Docker ne répond pas encore. Terminez son démarrage puis relancez ce fichier.'
    read '?Appuyez sur Entrée pour fermer.'
    exit 1
  fi
fi
docker compose up -d --build --wait
poke_exit_code=$?
if [ "$poke_exit_code" -eq 0 ]; then
  echo 'PokéClub est prêt : http://localhost:3000'
  echo 'Les services restent actifs après la fermeture de ce terminal.'
  open 'http://localhost:3000'
else
  echo 'Le démarrage a échoué. Consultez les messages ci-dessus.'
  read '?Appuyez sur Entrée pour fermer.'
fi
exit "$poke_exit_code"
