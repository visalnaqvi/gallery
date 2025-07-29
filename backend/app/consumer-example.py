import asyncio
import aio_pika
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RABBITMQ_URL = "amqp://guest:guest@localhost:5672/"
EXCHANGE_NAME = "file_uploads"

class UploadEventConsumer:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.exchange = None

    async def connect(self):
        """Connect to RabbitMQ"""
        try:
            self.connection = await aio_pika.connect_robust(RABBITMQ_URL)
            self.channel = await self.connection.channel()
            
            # Set QoS to process one message at a time
            await self.channel.set_qos(prefetch_count=1)
            
            # Declare exchange (should already exist)
            self.exchange = await self.channel.declare_exchange(
                EXCHANGE_NAME, 
                aio_pika.ExchangeType.TOPIC,
                durable=True
            )
            
            logger.info("Connected to RabbitMQ")
            
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    async def setup_queues(self):
        """Setup queues for different event types"""
        # Queue for successful uploads
        success_queue = await self.channel.declare_queue(
            "upload_success_queue", 
            durable=True
        )
        await success_queue.bind(self.exchange, "upload.success")
        
        # Queue for failed uploads
        failure_queue = await self.channel.declare_queue(
            "upload_failure_queue", 
            durable=True
        )
        await failure_queue.bind(self.exchange, "upload.failure")
        
        # Queue for batch events
        batch_queue = await self.channel.declare_queue(
            "upload_batch_queue", 
            durable=True
        )
        await batch_queue.bind(self.exchange, "upload.batch.*")
        
        return success_queue, failure_queue, batch_queue

    async def process_success_event(self, message: aio_pika.IncomingMessage):
        """Process successful upload events"""
        async with message.process():
            try:
                event_data = json.loads(message.body.decode())
                logger.info(f"✅ File uploaded successfully: {event_data['original_filename']}")
                logger.info(f"   URL: {event_data['public_url']}")
                logger.info(f"   Size: {event_data['file_size']} bytes")
                logger.info(f"   Time: {event_data['processing_time_seconds']:.2f}s")
                
                # Add your custom processing logic here
                await self.handle_successful_upload(event_data)
                
            except Exception as e:
                logger.error(f"Error processing success event: {e}")

    async def process_failure_event(self, message: aio_pika.IncomingMessage):
        """Process failed upload events"""
        async with message.process():
            try:
                event_data = json.loads(message.body.decode())
                logger.error(f"❌ File upload failed: {event_data['original_filename']}")
                logger.error(f"   Error: {event_data['error_message']}")
                logger.error(f"   User: {event_data['user_id']}")
                
                # Add your custom error handling logic here
                await self.handle_failed_upload(event_data)
                
            except Exception as e:
                logger.error(f"Error processing failure event: {e}")

    async def process_batch_event(self, message: aio_pika.IncomingMessage):
        """Process batch events (start/complete)"""
        async with message.process():
            try:
                event_data = json.loads(message.body.decode())
                
                if event_data['status'] == 'started':
                    logger.info(f"🚀 Batch upload started: {event_data['batch_id']}")
                    logger.info(f"   Files: {event_data['total_files']}")
                    logger.info(f"   Total size: {event_data['total_size_bytes']} bytes")
                    
                elif event_data['status'] == 'completed':
                    logger.info(f"✅ Batch upload completed: {event_data['batch_id']}")
                    logger.info(f"   Success: {event_data['successful_uploads']}")
                    logger.info(f"   Failed: {event_data['failed_uploads']}")
                    logger.info(f"   Time: {event_data['processing_time_seconds']:.2f}s")
                    
                elif event_data['status'] == 'failed':
                    logger.error(f"❌ Batch upload failed: {event_data['batch_id']}")
                
                # Add your custom batch processing logic here
                await self.handle_batch_event(event_data)
                
            except Exception as e:
                logger.error(f"Error processing batch event: {e}")

    async def handle_successful_upload(self, event_data: Dict[str, Any]):
        """Custom logic for successful uploads"""
        # Example: Update database, send notifications, etc.
        print(f"Processing successful upload: {event_data['filename']}")
        
        # You could:
        # - Update a database with file metadata
        # - Send notifications to users
        # - Trigger image processing workflows
        # - Update analytics/metrics
        # - Generate thumbnails
        # - Scan for viruses
        pass

    async def handle_failed_upload(self, event_data: Dict[str, Any]):
        """Custom logic for failed uploads"""
        # Example: Log errors, alert administrators, retry logic
        print(f"Handling failed upload: {event_data['original_filename']}")
        
        # You could:
        # - Log to error tracking system
        # - Send alerts to administrators
        # - Implement retry logic
        # - Update user notifications
        # - Track failure metrics
        pass

    async def handle_batch_event(self, event_data: Dict[str, Any]):
        """Custom logic for batch events"""
        # Example: Update progress tracking, analytics
        print(f"Handling batch event: {event_data['batch_id']} - {event_data['status']}")
        
        # You could:
        # - Update progress tracking in database
        # - Send progress notifications to users
        # - Update analytics dashboards
        # - Trigger post-processing workflows
        # - Generate batch reports
        pass

    async def start_consuming(self):
        """Start consuming messages from queues"""
        success_queue, failure_queue, batch_queue = await self.setup_queues()
        
        # Set up consumers
        await success_queue.consume(self.process_success_event)
        await failure_queue.consume(self.process_failure_event)
        await batch_queue.consume(self.process_batch_event)
        
        logger.info("Started consuming messages...")