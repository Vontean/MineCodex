import test from 'node:test';
import assert from 'node:assert/strict';
import {quickChatHistoryVisible} from '../src/adapters/codex/history.mjs';
test('native history visibility handles nesting, hidden ancestors and incomplete contracts',()=>{
  const history={props:{conversations:[],onConversationSelect(){},onNewChat(){}}};
  assert.equal(quickChatHistoryVisible({props:{children:[null,history]}}),true);
  for(const flag of ['hidden','inert','aria-hidden']) assert.equal(quickChatHistoryVisible({props:{[flag]:true,children:history}}),false);
  assert.equal(quickChatHistoryVisible({props:{conversations:[],onConversationSelect(){}}}),false);
  assert.equal(quickChatHistoryVisible(null),false);
});
