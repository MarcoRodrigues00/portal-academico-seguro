#!/usr/bin/env bash
# Comandos de verificação usados para coletar a evidência SPR3.
# Uso: HOST=<ip-ou-dominio-do-seu-host-DMZ/WAF> bash run-for-screenshot.sh
set -e
HOST="${HOST:?defina a variável HOST, ex: HOST=192.168.x.x bash run-for-screenshot.sh}"

echo "=== Verificação de escopo (ai-pentest-lab) ==="
echo "(rode dentro do diretório LAB-0.2/vpn-mode do ai-pentest-lab)"
echo "bash scripts/scan/verify-scope.sh \"$HOST\""
echo

echo "=== Baseline ==="
curl -k -s -o /dev/null -w "GET / -> %{http_code}\n" "https://$HOST/"
echo

echo "=== WAF: SQL Injection ==="
curl -k -s -o /dev/null -w "GET /?q=' OR 1=1-- -> %{http_code}\n" "https://$HOST/?q=%27%20OR%201%3D1--"

echo "=== WAF: XSS ==="
curl -k -s -o /dev/null -w "GET /?q=<script>alert(1)</script> -> %{http_code}\n" "https://$HOST/?q=%3Cscript%3Ealert(1)%3C/script%3E"
echo

echo "=== Rate limiting: 12x /api/login ==="
for i in $(seq 1 12); do curl -k -s -o /dev/null -w "%{http_code} " "https://$HOST/api/login"; done
echo
