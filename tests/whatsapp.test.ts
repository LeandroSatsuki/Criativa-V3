import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWhatsAppUrl, normalizeBrazilPhone } from '../src/services/whatsapp.ts';

test('normaliza celular brasileiro com codigo do pais', () => {
  assert.equal(normalizeBrazilPhone('(27) 99999-1234'), '5527999991234');
  assert.equal(normalizeBrazilPhone('+55 27 99999-1234'), '5527999991234');
});

test('nao cria link para telefone incompleto', () => {
  assert.equal(buildWhatsAppUrl('9999-1234'), null);
});

test('cria link direto seguro para o WhatsApp', () => {
  assert.equal(buildWhatsAppUrl('(27) 99999-1234'), 'https://wa.me/5527999991234');
});
