import type { Store } from './db.js';
import type { ProviderConfig } from '../shared/types.js';
import { evaluate } from './evaluation.js';

/** Durable queue with one worker. Interrupted calls are explicit failed tasks. */
export class AnalysisWorker {
  private timer?:ReturnType<typeof setInterval>;
  private active:Promise<void>|null=null;
  private controller?:AbortController;
  private stopping=false;
  constructor(private store:Store,private provider?:ProviderConfig){}
  start() {
    this.store.recoverInterrupted();
    this.timer=setInterval(()=>this.wake(),150);this.timer.unref();this.wake();
  }
  wake() {
    if(this.stopping||this.active)return;
    const next=this.store.tasks().filter(t=>t.status==='queued').at(-1);if(!next)return;
    this.active=this.run(next.id).finally(()=>{this.active=null;});
  }
  private async run(id:string) {
    this.controller=new AbortController();
    try {
      const task=this.store.startTask(id);
      const result=await evaluate({...task.input,signal:this.controller.signal},this.provider);
      this.store.completeTask(id,result);
    } catch(error) {
      this.store.failTask(id,error instanceof Error?error.message:'分析未完成，请重试。');
    }
  }
  async stop() {
    this.stopping=true;if(this.timer)clearInterval(this.timer);this.controller?.abort();
    await this.active;
  }
}
