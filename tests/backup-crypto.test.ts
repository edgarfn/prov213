import { describe, it, expect } from 'vitest'
import { encryptBuffer, decryptBuffer } from '../lib/backup'

const PAYLOAD = Buffer.from('Dados sensíveis da serventia — evidências e LGPD')

describe('backup encryption (AES-256-GCM + scrypt)', () => {
  it('criptografa e descriptografa corretamente', () => {
    const passphrase = 'MinhaFraseLonga!2024#Cartório'
    const encrypted = encryptBuffer(PAYLOAD, passphrase)
    const decrypted = decryptBuffer(encrypted, passphrase)
    expect(decrypted.equals(PAYLOAD)).toBe(true)
  })

  it('o buffer criptografado é diferente do plaintext', () => {
    const encrypted = encryptBuffer(PAYLOAD, 'SenhaQualquer!123')
    expect(encrypted.equals(PAYLOAD)).toBe(false)
  })

  it('dois encripts do mesmo payload geram buffers diferentes (IV aleatório)', () => {
    const pass = 'TestPass!123abc'
    const e1 = encryptBuffer(PAYLOAD, pass)
    const e2 = encryptBuffer(PAYLOAD, pass)
    expect(e1.equals(e2)).toBe(false)
  })

  it('frase-senha errada lança erro (GCM authTag)', () => {
    const encrypted = encryptBuffer(PAYLOAD, 'SenhaCorreta!123')
    expect(() => decryptBuffer(encrypted, 'SenhaErrada!456')).toThrow()
  })

  it('dados corrompidos lançam erro', () => {
    const encrypted = encryptBuffer(PAYLOAD, 'MinhaFrase!123')
    // Corrompe 1 byte no meio do ciphertext
    const corrupted = Buffer.from(encrypted)
    corrupted[corrupted.length - 10] ^= 0xff
    expect(() => decryptBuffer(corrupted, 'MinhaFrase!123')).toThrow()
  })

  it('buffer muito curto lança erro descritivo', () => {
    expect(() => decryptBuffer(Buffer.alloc(10), 'qualquer')).toThrow(
      'Arquivo de backup inválido ou corrompido',
    )
  })

  it('preserva payloads grandes (simula ZIP 1 MB)', () => {
    const large = Buffer.alloc(1024 * 1024, 0xab)
    const pass = 'PasseGrande!9876'
    const enc = encryptBuffer(large, pass)
    const dec = decryptBuffer(enc, pass)
    expect(dec.equals(large)).toBe(true)
  })
})
