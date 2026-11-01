import test from 'node:test';
import assert from 'node:assert/strict';
import { validResetPassword } from '../reset-auth.js';

test('limpeza aceita apenas a senha configurada e exige configuração forte', () => {
  const secret='senha-de-teste-123';
  assert.equal(validResetPassword(secret,secret),true);
  for(const supplied of ['',null,42,'senha-errada','senha-de-teste-123 ']) {
    assert.equal(validResetPassword(supplied,secret),false);
  }
  assert.equal(validResetPassword('curta','curta'),false);
  assert.equal(validResetPassword('',''),false);
});
