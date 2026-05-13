class ClaimHandler{
    #tryFetch = false
    #concurrency 
    constructor({
        QueueStateManager,
        selectJobFromWaiting,
        getConcurrency,
        getActiveCount,
        insert
    })
    {
        this.QueueStateManager = QueueStateManager
        this.selectJobFromWaiting = selectJobFromWaiting
        this.getConcurrency = getConcurrency
        this.getActiveCount = getActiveCount
        this.insert = insert
        this.#concurrency = this.getConcurrency()
    }

    startFetchOperation = async () =>{  
        while(true){
            if(!this.hasSlot()){
                break;
            }
            
            try {
            await this.fetchJob()
            } finally {
                this.setFetch(false)   
            }
        }
    }

    hasSlot = () =>{
        if(this.getFetch()) return false
        if(this.getActiveCount() >= this.#concurrency) return false 
        this.setFetch(true)
        return true
    }
    getFetch() { return this.#tryFetch}
    setFetch(value) { return this.#tryFetch = value }

}