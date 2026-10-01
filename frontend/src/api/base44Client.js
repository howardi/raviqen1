import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { invokeLiveLLM } from '@/lib/liveAI';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const base44Integrations = base44.integrations;
base44.integrations = new Proxy(base44Integrations, {
  get(target, prop, receiver) {
    if (prop !== "Core") return Reflect.get(target, prop, receiver);
    const core = target.Core;
    return new Proxy(core, {
      get(coreTarget, name, coreReceiver) {
        if (name === "InvokeLLM") return (args) => invokeLiveLLM(args || {});
        return Reflect.get(coreTarget, name, coreReceiver);
      },
    });
  },
});
