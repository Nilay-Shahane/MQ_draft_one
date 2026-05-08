class ClaimHandler{
    #tryFetch = false
    #concurrency 
    constructor({
        selectJobFromWaiting,
        getConcurrency,
        getActiveCount,
        insert
    })
    {
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

    fetchJob = async () =>{
        const sequence = this.queueDecider()
        const jobId = await this.selectJobFromWaiting(sequence)
        const respFromActive = await this.insert(jobId)
        return respFromActive
    }
    getFetch() { return this.#tryFetch}

    setFetch(value) { return this.#tryFetch = value }

    queueDecider = () => {
        let number = this.randomNumber()
        console.log(`Random number = ${number}`)
        let [q1,q2] = ['','']
        if(number<=70) [q1 , q2] = ['PrioQ' , 'NormalQ']
        else [q1 , q2] = ['NormalQ' , 'PrioQ']
        console.log(`The priority of fetching is ${q1} , ${q2}`)
        return [q1,q2]
    }

    randomNumber = () =>{
        return Math.random() * 100 ;
    }
}