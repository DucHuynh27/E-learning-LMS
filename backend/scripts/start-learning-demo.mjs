process.env.PORT = '3002';
process.env.PGOPTIONS = '-c search_path=learning_demo,public';

await import('../dist/main.js');
