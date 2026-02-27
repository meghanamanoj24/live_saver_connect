import hashlib
import time
import secrets
from .models import PDFIntegrityLedger
class BlockchainService:
    @staticmethod
    def compute_hash(data):
        """Computes SHA-256 hash of bytes data."""
        if isinstance(data, str):
            data = data.encode()
        return hashlib.sha256(data).hexdigest()
    @staticmethod
    def record_download(user, pdf_content, download_id=None, timestamp=None, report_type="OTHER"):
        """
        Computes the hash of the PDF, creates a new block in the integrity ledger,
        and links it to the previous block.
        """
        pdf_hash = BlockchainService.compute_hash(pdf_content)
        
        if not download_id:
            download_id = f"DL-{secrets.token_hex(8).upper()}"
        
        if not timestamp:
            timestamp = str(time.time())
            
        # If this is an organ pledge, invalidate all previous reports for this user
        if report_type == "ORGAN_PLEDGE":
            PDFIntegrityLedger.objects.filter(
                user=user, 
                report_type="ORGAN_PLEDGE", 
                is_active=True
            ).update(is_active=False)

        # Get the latest block
        last_block = PDFIntegrityLedger.objects.order_by('-created_at').first()
        prev_hash = last_block.block_hash if last_block else "0" * 64
        
        # Simulate mining/block creation
        nonce = 0
        block_hash = ""
        
        # Simplified block hash: hash(prev_hash + pdf_hash + download_id + timestamp + nonce)
        while True:
            block_data = f"{prev_hash}{pdf_hash}{download_id}{timestamp}{nonce}"
            block_hash = BlockchainService.compute_hash(block_data)
            # Simulate a "difficulty" (e.g. hash must start with '0')
            if block_hash.startswith("0"): 
                break
            nonce += 1
            
        from django.core.files.base import ContentFile
        
        # Store in ledger
        ledger_entry = PDFIntegrityLedger.objects.create(
            user=user,
            download_id=download_id,
            report_type=report_type,
            pdf_hash=pdf_hash,
            previous_block_hash=prev_hash,
            block_hash=block_hash,
            nonce=nonce
        )
        
        # Save the actual PDF file
        filename = f"report_{download_id}.pdf"
        ledger_entry.pdf_file.save(filename, ContentFile(pdf_content))
        
        return ledger_entry