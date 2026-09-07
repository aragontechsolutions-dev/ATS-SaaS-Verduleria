import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerPagoId } from './payments.webhook.ts';

test('extraerPagoId: querystring type=payment&data.id', () => {
  assert.equal(extraerPagoId(undefined, { type: 'payment', 'data.id': '123' }), '123');
});

test('extraerPagoId: querystring topic=payment&id', () => {
  assert.equal(extraerPagoId(undefined, { topic: 'payment', id: '456' }), '456');
});

test('extraerPagoId: body { type:"payment", data:{ id } }', () => {
  assert.equal(extraerPagoId({ type: 'payment', data: { id: 789 } }, {}), '789');
});

test('extraerPagoId: body action payment.created', () => {
  assert.equal(extraerPagoId({ action: 'payment.created', data: { id: '111' } }, {}), '111');
});

test('extraerPagoId: ignora eventos que no son de pago (merchant_order)', () => {
  assert.equal(extraerPagoId({ type: 'merchant_order', data: { id: '999' } }, {}), null);
  assert.equal(extraerPagoId(undefined, { topic: 'merchant_order', id: '999' }), null);
});

test('extraerPagoId: sin id devuelve null', () => {
  assert.equal(extraerPagoId({ type: 'payment' }, {}), null);
  assert.equal(extraerPagoId(undefined, undefined), null);
});
