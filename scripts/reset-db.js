"use strict";

/**
 * Recria o banco de dados local com o conteúdo demonstrativo do seed.
 *
 * Uso:
 *   npm run db:reset
 *
 * Pare o servidor antes de executar. O script apaga o arquivo SQLite atual
 * (incluindo WAL/SHM) e cria um novo banco já populado. Todos os dados locais
 * — contas, matrículas, progresso, pedidos e certificados — serão perdidos.
 */

const fs = require("node:fs");
const path = require("node:path");

const config = require("../server/config");
const { openDatabase } = require("../server/db");

function removeIfExists(file) {
  if (!fs.existsSync(file)) return false;
  try {
    fs.unlinkSync(file);
    return true;
  } catch (error) {
    if (error.code === "EBUSY" || error.code === "EPERM") {
      console.error(
        `\nNão foi possível apagar ${path.basename(file)} porque ele está em uso.\n` +
          "Pare o servidor (Ctrl+C) e execute o comando novamente.\n"
      );
      process.exit(1);
    }
    throw error;
  }
}

async function main() {
  if (config.turso.url) {
    console.error(
      "\nTURSO_DATABASE_URL está definido: este comando recria apenas o banco local.\n" +
        "Remova a variável para resetar o arquivo SQLite de desenvolvimento.\n"
    );
    process.exit(1);
  }
  const dbPath = config.dbPath;
  console.log(`[db] Banco de dados: ${dbPath}`);
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (removeIfExists(file)) console.log(`[db] Removido ${path.basename(file)}`);
  }
  await openDatabase();
  console.log("[db] Banco recriado e populado com o conteúdo demonstrativo.");
  console.log("\nAcessos de demonstração:");
  console.log(`  Aluno:      aluno@brasiltec.demo / Aluno@2026`);
  console.log(`  Instrutor:  instrutor@brasiltec.demo / Instrutor@2026`);
  console.log(`  Admin:      ${config.admin.email} / ${config.admin.password}`);
  console.log("\nInicie o servidor com: npm start");
}

main().catch((error) => {
  console.error("[db] Falha ao recriar o banco:", error);
  process.exit(1);
});
