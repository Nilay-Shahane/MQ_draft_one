const Jiniq = require('./src/queue/Jiniq');
const Worker = require('./src/supervisor/worker/Worker');

async function testJiniq() {
    console.log("🚀 Booting up Jiniq Queue System...\n");

    // 1. Setup Producer
    const myQueue = new Jiniq('email-queue');
    
    // 2. Setup Consumer (The user's processing logic)
    // Idempotent design: Safe against duplicate deliveries
    const emailProcessor = async (payload, signal) => {
        console.log(`[Processor] Checking if email to ${payload.email} was already sent...`);
        const alreadySent = false; // Simulate database check
        
        if (alreadySent) {
            console.log(`[Processor] Email to ${payload.email} already exists. Skipping.`);
            return "Skipped (Already Processed)";
        }

        console.log(`[Processor] Sending email to ${payload.email}...`);
        // Simulate a 2-second I/O task
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
        return "Email Sent Successfully!";
    };

    const worker = new Worker('email-queue', emailProcessor);

    // 3. The Developer Listens for Events
    worker.on('job:completed', (data) => {
        console.log(`✅ Success! Job ID: ${data.jobId} | Result: ${data.result}`);
    });

    worker.on('job:failed', (data) => {
        console.log(`❌ Failed! Job ID: ${data.jobId} | Error: ${data.error}`);
    });

    // 4. Start the system and push a job
    await worker.start();
    
    console.log("📤 Pushing test job to the queue...");
    await myQueue.addJob('welcome-email', { email: 'test@example.com' });

    // 5. OS-Level Graceful Shutdown (Signal Handling)
    const shutdown = async () => {
        console.log('\n[System] OS Interrupt received. Initiating graceful shutdown...');
        await worker.stop();
        await myQueue.close(); 
        console.log('[System] Connections closed. Clean exit.');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);  // Catches Ctrl+C in terminal
    process.on('SIGTERM', shutdown); // Catches Docker/Server stop commands
}

testJiniq().catch(err => {
    console.error("Fatal Error in Test Script:", err);
});