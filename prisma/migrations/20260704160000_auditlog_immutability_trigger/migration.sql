-- Reforço de imutabilidade do log de auditoria (Art. 7º; seção 6 da spec).
-- A cadeia de hash SHA-256 (lib/audit.ts) já detecta adulteração a posteriori
-- (tamper-evident); este trigger impede fisicamente UPDATE/DELETE na tabela
-- AuditLog a nível de banco (tamper-proof), reforçando a garantia de que o
-- log é append-only. Nenhuma rotina do sistema atualiza ou exclui registros
-- de AuditLog (confirmado por revisão do código antes desta migration).

CREATE FUNCTION prevent_auditlog_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog é append-only: UPDATE e DELETE não são permitidos (Art. 7º do Provimento CNJ 213/2026)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditlog_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_auditlog_mutation();

CREATE TRIGGER auditlog_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_auditlog_mutation();
