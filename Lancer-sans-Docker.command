#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export LANG=C
export LC_ALL=C
node scripts/setup-local.cjs && node scripts/start-local.mjs --open
poke_exit_code=$?
if [ "$poke_exit_code" -ne 0 ]; then
  read '?Le lancement a échoué. Appuyez sur Entrée pour fermer.'
fi
exit "$poke_exit_code"
