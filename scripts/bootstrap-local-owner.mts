import { createHash } from "node:crypto";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { hashPassword } from "better-auth/crypto";
import nextEnv from "@next/env";

const expectedEmail = "auditoria.cp.20260914@example.com";
const expectedOrganizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const expectedOrganizationName = "CP 2.1 Demonstração";
const databaseFile = "central-precatorios.db";

function requireLocalDevelopment() {
  if (!process.argv.includes("--local-development") || !process.argv.includes("--confirm-local-owner")) {
    throw new Error("Confirme o reset local executando: npm run auth:bootstrap-local-owner -- --confirm-local-owner");
  }
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    throw new Error("Este comando só pode ser executado em desenvolvimento local.");
  }

  const databaseUrl = process.env.DATABASE_URL || `file:${databaseFile}`;
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?")) {
    throw new Error("Recusado: DATABASE_URL deve apontar para o banco SQLite local padrão.");
  }
  const configuredPath = resolve(process.cwd(), decodeURIComponent(databaseUrl.slice("file:".length)));
  const expectedPath = resolve(process.cwd(), databaseFile);
  if (configuredPath !== expectedPath) {
    throw new Error(`Recusado: este comando só pode alterar ${databaseFile}.`);
  }
  return databaseUrl;
}

async function readHiddenPassword(label: string) {
  const terminal = stdin as typeof stdin & { setRawMode?: (enabled: boolean) => void };
  if (!terminal.isTTY || !terminal.setRawMode) {
    throw new Error("Execute o comando em um terminal interativo para não expor a senha.");
  }

  stdout.write(label);
  terminal.setEncoding("utf8");
  terminal.setRawMode(true);
  terminal.resume();

  return new Promise<string>((resolvePassword, rejectPassword) => {
    let password = "";
    const finish = (error?: Error) => {
      terminal.off("data", onData);
      terminal.setRawMode?.(false);
      stdout.write("\n");
      if (error) rejectPassword(error);
      else resolvePassword(password);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Operação cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = Array.from(password).slice(0, -1).join("");
          stdout.write("\b \b");
          continue;
        }
        if (character >= " " && character !== "\u007f") {
          password += character;
          stdout.write("*");
        }
      }
    };
    terminal.on("data", onData);
  });
}

function operationsFingerprint(rows: Record<string, unknown>[]) {
  const serialized = rows.map((row) =>
    Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right))),
  );
  return createHash("sha256").update(JSON.stringify(serialized)).digest("hex");
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const databaseUrl = requireLocalDevelopment();
  const db = createClient({ url: databaseUrl });
  const initialUser = await db.execute({
    sql: "SELECT id,name,email FROM user WHERE email=?",
    args: [expectedEmail],
  });
  const initialOrganization = await db.execute({
    sql: "SELECT id,name FROM organization WHERE id=?",
    args: [expectedOrganizationId],
  });
  if (initialUser.rows.length !== 1 || initialOrganization.rows.length !== 1) {
    throw new Error("A conta owner ou a organização de destino não foi encontrada de forma única.");
  }
  if (String(initialOrganization.rows[0].name) !== expectedOrganizationName) {
    throw new Error("O ID da organização não corresponde ao nome esperado; nenhuma alteração foi feita.");
  }
  const userId = String(initialUser.rows[0].id);
  const membership = await db.execute({
    sql: "SELECT role FROM member WHERE userId=? AND organizationId=?",
    args: [userId, expectedOrganizationId],
  });
  if (membership.rows.length !== 1 || String(membership.rows[0].role).toLowerCase() !== "owner") {
    throw new Error("A conta não é owner único da organização de destino; nenhuma alteração foi feita.");
  }
  const credential = await db.execute({
    sql: "SELECT id FROM account WHERE userId=? AND accountId=? AND providerId='credential'",
    args: [userId, userId],
  });
  if (credential.rows.length !== 1) {
    throw new Error("A credencial local não foi encontrada de forma única; nenhuma alteração foi feita.");
  }

  console.log("Escopo confirmado: desenvolvimento local · banco central-precatorios.db");
  console.log(`Conta: ${expectedEmail} · organização owner: ${expectedOrganizationName}`);
  console.log("Apenas o hash da senha será atualizado. Operações, memberships e organizações não serão alterados.");
  console.log("PASSO 1/2: digite uma nova senha (1 a 128 caracteres). Senhas curtas são temporárias e serão avisadas; o terminal não mostrará os caracteres.");
  let password = await readHiddenPassword("Nova senha: ");
  console.log("PASSO 2/2: digite novamente a mesma senha para confirmar.");
  const confirmation = await readHiddenPassword("Repita a nova senha: ");
  if (password.length < 1 || password.length > 128 || password !== confirmation) {
    password = "";
    throw new Error("As senhas devem ser iguais e ter entre 1 e 128 caracteres.");
  }
  if (password.length < 12) console.warn("AVISO: senha temporária fraca. Troque-a imediatamente após entrar; este reset é restrito ao ambiente local.");
  const newHash = await hashPassword(password);
  password = "";

  const tx = await db.transaction("write");
  try {
    const operationsBefore = await tx.execute({
      sql: "SELECT * FROM operations WHERE organization_id=? ORDER BY id",
      args: [expectedOrganizationId],
    });
    const fingerprintBefore = operationsFingerprint(operationsBefore.rows as Record<string, unknown>[]);
    const currentMembership = await tx.execute({
      sql: "SELECT role FROM member WHERE userId=? AND organizationId=?",
      args: [userId, expectedOrganizationId],
    });
    if (currentMembership.rows.length !== 1 || String(currentMembership.rows[0].role).toLowerCase() !== "owner") {
      throw new Error("O membership owner mudou durante a operação; reset cancelado.");
    }
    const updated = await tx.execute({
      sql: "UPDATE account SET password=?,updatedAt=? WHERE id=? AND userId=? AND accountId=? AND providerId='credential'",
      args: [newHash, new Date().toISOString(), String(credential.rows[0].id), userId, userId],
    });
    if (updated.rowsAffected !== 1) throw new Error("A credencial não foi atualizada de forma única.");
    const operationsAfter = await tx.execute({
      sql: "SELECT * FROM operations WHERE organization_id=? ORDER BY id",
      args: [expectedOrganizationId],
    });
    if (
      operationsAfter.rows.length !== operationsBefore.rows.length ||
      operationsFingerprint(operationsAfter.rows as Record<string, unknown>[]) !== fingerprintBefore
    ) {
      throw new Error("A verificação de integridade das operações falhou; transação cancelada.");
    }
    await tx.commit();
    console.log("Reset local concluído. A senha não foi exibida nem gravada fora do hash Better Auth.");
    console.log(`Operações preservadas: ${operationsAfter.rows.length}; conta e membership não foram recriados ou alterados.`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha no bootstrap local.");
  process.exitCode = 1;
});