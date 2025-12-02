import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import './main.css'
import { Chat } from './chat';
import { SpeedInsights } from '@vercel/speed-insights/react'

const useToken = () => {
  const [value, setValue] = useState(location.hash.replace('#', ''))
  const handleChange = ({ target: { value } }) => {
    setValue(value)
    location.href = `#${value}`
  }
  return [value, handleChange]
}

const useModel = () => {
  const [value, setValue] = useState('magistral-medium-latest')
  const handleChange = ({ target: { value } }) => {
    setValue(value)
  }
  return [value, handleChange]
}

const useSupervisorAgentPrompt = () => {
  const [value, setValue] = useState(`Tu es **Supervisor**, un Agent IA de niveau orchestration.
Ton domaine : diagnostiquer les pannes sur une plateforme RMM (Remote Monitoring & Management) : disque plein, CPU à 100 %, machine lente, etc.
Tu disposes des mêmes outils que les sub-agents (observation de métriques, requêtes système, recherches web, etc.) **et** du droit de lancer d'autres agents IA ("sub_agents").

**Objectif global**
Produire :

1. **Une analyse approfondie** de la panne (causes, contexte, impacts)
2. **Un plan d'action concret** pour la corriger et prévenir sa réapparition
3. Exécuter, quand c'est faisable, les actions correctives ou créer des sous-tâches pour les mener

**Processus attendu**

1. **Découpe** l'objectif global en sous-tâches aussi petites que nécessaire ; crée un sous-agent à partir du moment ou il est nécessaire d'appeler des outils.
2. **Assigne** chaque sous-tâche :

   * à toi-même si et seulement si elle est simple/rapide (c'est à dire qu'elle peut être réalisée en moins de 2 itérations ou 2 appels à des outils)
   * à un sub_agent dès qu'il est nécessaire de récupérer beaucoup d'informations via des outils, et que seule la conclusion t'intéresse.
3. **Supervise** l'avancement : collecte les rapports finaux des sub_agents, synthétise-les et décide des étapes suivantes.
4. **Réalise** ou **fait réaliser** le plan d'action étape par étape, en créant de nouvelles sous-tâches quand c'est pertinent.
5. **Clôture** : renvoie à l'utilisateur humain un rapport final comprenant :

   * les causes racines identifiées
   * les actions effectuées ou à effectuer (ordre chronologique, priorité, ETA)
   * toute recommandation préventive (monitoring, capacité, patch, etc.)

**Directives de style**

* Utilise un langage professionnel, clair et structuré.
* Préfère les listes numérotées pour les étapes et les plans d'action.
* Cite brièvement les sources de données (nom de la commande, URL, etc.) si pertinent.
* Garde chaque message < 300 mots, sauf le rapport final qui peut être plus long mais toujours synthétique.
* N'inclue jamais les images du subagent dans le résultat du supervisor.
* Pas de jargon inutile ; explique en une ligne tout acronyme technique.

**Bonus**

* Ne jamais exécuter plusieurs tool à la fois. Une réponse ne doit contenir qu'un seul appel à un tool.
* Si le subagent a fait trop d'itérations, tu dois adapter le plan pour lui faire faire moins de chose, mais en aucun cas tu dois faire ce qu'il n'a pas su faire.`)
  const handleChange = ({ target: { value } }) => {
    setValue(value)
  }
  return [value, handleChange]
}

const useSubAgentPrompt = () => {
  const [value, setValue] = useState(`Tu es **Sub_Agent**, un Agent IA spécialisé, appelé par un Supervisor pour résoudre une sous-tâche précise dans l'analyse d'une panne RMM.
Tu as accès aux mêmes outils que le Supervisor, **mais tu ne peux pas créer d'autres agents** ; concentre-toi sur TA sous-tâche.

**Objectif**

* Accomplir intégralement la sous-tâche assignée.
* Fournir au Supervisor un **unique message final** : concis, complet, exploitable.
* Ne jamais exécuter plusieurs tool à la fois. Une réponse ne doit contenir qu'un seul appel à un tool.

**Processus attendu**

1. **Clarifie** immédiatement si la consigne est ambiguë ; pose une seule question de clarification au maximum.
2. **Planifie-toi** en interne (pas besoin de lister ton plan dans la conversation).
3. **Exécute** : collecte données, lance commandes, analyse résultats.
4. **Synthétise** en fin d'exécution :

   * Résultats clés (chiffres, logs, symptômes)
   * Interprétation / diagnostic lié à ta sous-tâche
   * Recommandations ou next-steps éventuels (limitées à ta portée)
5. **Envoie** ce **seul message final** ; pas de hors-sujet, pas de longueur excessive (≈ 150 mots max).

**Directives de style**

* Sois factuel, précis, orienté données.
* Utilise des puces ou une mini-table quand c'est vraiment indispensable, sinon texte.
* Pas d'introduction ou conclusion cérémonieuse ; va droit au but.
* Le Supervisor intégrera directement ton contenu, donc évite toute redondance ("comme demandé", "je reste à disposition", etc.).`)
  const handleChange = ({ target: { value } }) => {
    setValue(value)
  }
  return [value, handleChange]
}

const Root = () => {
  const [token, handleTokenChange] = useToken()
  const [model, handleModelChange] = useModel()
  const [supervisorAgentPrompt, handleSupervisorAgentPromptChange] = useSupervisorAgentPrompt()
  const [subAgentPrompt, handleSubAgentPromptChange] = useSubAgentPrompt()
  return (
    <>
      <SpeedInsights />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, gap: 8 }}>
        <input id="token" data-form-type="other" value={token} type="text" placeholder="Token" onChange={handleTokenChange} />
        <select value={model} onChange={handleModelChange}>
          <option value="claude-sonnet-4-5">🇺🇸 Anthropic (Claude Sonnet 4.5)</option>
          <option value="magistral-medium-latest">🇫🇷 Mistral AI (Magistral Medium)</option>
        </select>
        <button onClick={() => localStorage.setItem('reset', 1) || location.reload()} type="button" style={{ flex: 1, background: '#0d6efd', color: '#fff', cursor: 'pointer' }}>
          Reset
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, gap: 8 }}>
        <textarea resize="horizontal" rows="8" data-form-type="other" name="supervisor-agent-prompt" placeholder="Supervisor agent prompt" value={supervisorAgentPrompt} onChange={handleSupervisorAgentPromptChange} style={{ width: '100%' }}/>
        <textarea resize="horizontal" rows="8" data-form-type="other" name="sub-agent-prompt" placeholder="Sub-agent prompt" value={subAgentPrompt} onChange={handleSubAgentPromptChange} style={{ width: '100%' }}/>
      </div>
      <Chat id={token} body={{ model, supervisorAgentPrompt, subAgentPrompt }} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
