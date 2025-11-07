import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const newSchema = {
    type: "function",
    function: {
      name: "schedule_meeting",
      description: "Agenda uma reunião, demo ou call com o cliente no calendário. IMPORTANTE: sempre calcule end_time somando a duração ao start_time.",
      parameters: {
        type: "object",
        required: ["title", "start_time", "end_time"],
        properties: {
          title: {
            type: "string",
            description: "Título da reunião (ex: Demo Produto X)"
          },
          description: {
            type: "string",
            description: "Descrição/pauta da reunião"
          },
          start_time: {
            type: "string",
            description: "Data e hora de início no formato ISO 8601 (ex: 2025-11-10T14:00:00-03:00)"
          },
          end_time: {
            type: "string",
            description: "Data e hora de término no formato ISO 8601. Calcule somando a duração desejada ao start_time (ex: para 1h de duração, se start_time é 2025-11-10T14:00:00-03:00, end_time seria 2025-11-10T15:00:00-03:00)"
          },
          location: {
            type: "string",
            description: "Local ou link da reunião (ex: Google Meet, Zoom, escritório)"
          },
          event_type: {
            type: "string",
            enum: ["MEETING", "DEMO", "FOLLOW_UP", "CALL"],
            description: "Tipo do evento: MEETING (reunião geral), DEMO (demonstração), FOLLOW_UP (acompanhamento), CALL (ligação)"
          }
        }
      }
    }
  };

  const { data, error } = await supabaseAdmin
    .from("tools_catalog")
    .update({
      schema: newSchema,
      description: "Agenda uma reunião, demo ou call com o cliente. Cria um evento no calendário com data/hora de início e fim. IMPORTANTE: sempre calcule end_time somando a duração ao start_time."
    })
    .eq("key", "schedule_meeting")
    .select();

  if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  console.log("✅ Tool updated successfully");
  console.log(JSON.stringify(data, null, 2));
}

main();
