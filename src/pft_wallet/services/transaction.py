from typing import Dict, Any
from xrpl.models.transactions import Payment, Memo
import binascii
from xrpl.clients import JsonRpcClient
from xrpl.models.requests import Fee
from xrpl.models.amounts import IssuedCurrencyAmount

class TransactionBuilder:
    """Service for building XRPL transactions for user-to-node communication."""
    
    def __init__(self):
        self.node_address = 'r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD'  # Post Fiat Node address
        self.client_url = "https://s1.ripple.com:51234/"
        self.pft_issuer = 'rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW'  # PFT token issuer
    
    def _to_hex(self, string: str) -> str:
        """Convert string to hex format"""
        return binascii.hexlify(string.encode()).decode()
    
    def _get_fee(self) -> str:
        """Get current network fee"""
        return "10"  # Simplified for now, we'll implement proper fee logic later
    
    def build_transaction(self, 
                         account: str,
                         tx_type: str,
                         data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build a user-to-node transaction based on the transaction type.
        
        Args:
            account: The user's XRPL address
            tx_type: Type of transaction (e.g., 'initiation_rite', 'task_request', etc.)
            data: Dictionary containing transaction-specific data
            
        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Define memo structure based on transaction type
        memo_structures = {
            'initiation_rite': {
                'data': f"{data.get('initiation_rite', '')}",
                'type': "INITIATION_RITE_SUBMISSION",
                'format': data.get('username', ''),
                'use_pft': False
            },
            'task_request': {
                'data': f"REQUEST_POST_FIAT ___ {data.get('request', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_acceptance': {
                'data': f"ACCEPTANCE REASON ___ {data.get('message', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_refusal': {
                'data': f"REFUSAL REASON ___ {data.get('refusal_reason', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_completion': {
                'data': f"COMPLETION JUSTIFICATION ___ {data.get('completion_justification', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'verification_response': {
                'data': f"VERIFICATION RESPONSE ___ {data.get('verification_response', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            }
        }
        
        if tx_type not in memo_structures:
            raise ValueError(f"Transaction type '{tx_type}' is not supported")
        
        try:
            memo_structure = memo_structures[tx_type]
            
            # Determine amount and currency based on transaction type
            if memo_structure['use_pft']:
                amount = IssuedCurrencyAmount(
                    currency="PFT",
                    issuer=self.pft_issuer,
                    value="1"
                )
            else:
                amount = "1"  # 1 drop of XRP for initiation rite
            
            # Build the payment transaction
            payment = Payment(
                account=account,
                destination=self.node_address,
                amount=amount,
                fee=current_fee,
                memos=[
                    Memo(
                        memo_data=self._to_hex(memo_structure['data']),
                        memo_type=self._to_hex(memo_structure['type']),
                        memo_format=self._to_hex(memo_structure['format'])
                    )
                ]
            )
            
            return payment.to_dict()
        except KeyError as e:
            raise ValueError(f"Missing required field for {tx_type} transaction: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error building {tx_type} transaction: {str(e)}")
