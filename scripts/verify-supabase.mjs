import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('=== VERIFICAÇÃO PÓS-MIGRATION EM RUNTIME ===');
console.log('Supabase URL:', url);

const supabase = createClient(url, anonKey);

async function verify() {
  console.log('\n--- 1. VERIFICAÇÃO DE TABELAS ---');
  const { data: dRes, error: eRes } = await supabase.from('reserves').select('*').limit(1);
  console.log('public.reserves:', eRes ? `ERRO: ${eRes.message}` : `OK (Encontrado no cache, linhas: ${dRes?.length})`);

  const { data: dTx, error: eTx } = await supabase.from('reserve_transactions').select('*').limit(1);
  console.log('public.reserve_transactions:', eTx ? `ERRO: ${eTx.message}` : `OK (Encontrado no cache, linhas: ${dTx?.length})`);

  const { data: dEps, error: eEps } = await supabase.from('expense_payment_sources').select('*').limit(1);
  console.log('public.expense_payment_sources:', eEps ? `ERRO: ${eEps.message}` : `OK (Encontrado no cache, linhas: ${dEps?.length})`);

  console.log('\n--- 2. VERIFICAÇÃO DAS 9 RPCS ---');
  const rpcs = [
    'rpc_create_reserve',
    'rpc_deposit_to_reserve',
    'rpc_withdraw_from_reserve',
    'rpc_transfer_between_reserves',
    'rpc_pay_expense_from_sources',
    'rpc_refund_expense_payment',
    'rpc_adjust_expense_payment_amount',
    'rpc_change_expense_payment_origin',
    'rpc_archive_or_delete_reserve'
  ];

  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc, {});
    // If RPC doesn't exist in schema cache, PostgREST returns 404 "Could not find the function..."
    // If RPC exists, it executes and throws application error (e.g., parameter null / access error)
    if (error && error.message && error.message.includes('Could not find the function')) {
      console.log(`${rpc}: NÃO EXISTE (${error.message})`);
    } else if (error) {
      console.log(`${rpc}: OK (Reconhecida pelo schema cache do Supabase; resposta: "${error.message}")`);
    } else {
      console.log(`${rpc}: OK (Executada com sucesso)`);
    }
  }
}

verify().catch(e => console.error('Erro na validação:', e));
