
import { db } from './backend/src/pg.ts';

async function seed() {
  try {
    const scenarios = [
      { 
        name: 'Saudação Inicial', 
        description: 'Teste de saudação básica',
        input_data: { message: 'Olá, quem é você?' }, 
        expected_output: 'Deve se identificar como assistente',
        category: 'GREETING'
      },
      { 
        name: 'Dúvida sobre Preço', 
        description: 'Teste de conhecimento de preços',
        input_data: { message: 'Quanto custa o plano premium?' }, 
        expected_output: 'Deve informar valores do plano premium',
        category: 'FAQ'
      }
    ];

    for (const s of scenarios) {
      await db.none(
        `INSERT INTO agent_test_scenarios (name, description, input_data, expected_output, category)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`,
        [s.name, s.description, s.input_data, s.expected_output, s.category]
      );
    }
    console.log('Scenarios seeded successfully');
  } catch (error) {
    console.error('Error seeding scenarios:', error);
  } finally {
    process.exit();
  }
}

seed();
