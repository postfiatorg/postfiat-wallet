import requests
import logging
from .task_storage import TaskStorage, TaskState

class Transaction:
    """
    Service for creating and managing XRPL transactions.
    """
    def __init__(self):
        self.base_url = "http://localhost:5001/api/v1"
        self.task_storage = TaskStorage()

    def create_initiation_rite_transaction(self, transaction_data: dict) -> dict:
        """
        Create an initiation rite transaction by calling the external txn service endpoint.
        
        Args:
            transaction_data: Dictionary containing:
                - account: The XRPL account initiating the transaction
                - destination: The XRPL account receiving the transaction
                - initiation_rite: The text of the initiation rite
                - username: The discord username
                - amount: (Optional) The amount to transfer (defaults to "1")
        
        Returns:
            dict: The unsigned transaction structure from the service
            
        Raises:
            Exception: If the request fails or returns an error status
        """
        url = f"{self.base_url}/user/initiation-rite-tx"
        
        logging.debug(f"Sending initiation rite request to: {url}")
        logging.debug(f"Transaction data: {transaction_data}")
        
        try:
            response = requests.post(url, json=transaction_data)
            logging.debug(f"Response status code: {response.status_code}")
            logging.debug(f"Response content: {response.text}")
            
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") != "success":
                error_msg = data.get('error', 'Unknown error')
                logging.error(f"Transaction service error: {error_msg}")
                raise Exception(f"Error from transaction service: {error_msg}")
                
            return data["transaction"]
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to create initiation rite transaction: {str(e)}")
            logging.error(f"Request URL: {url}")
            logging.error(f"Request data: {transaction_data}")
            if hasattr(e, 'response') and e.response is not None:
                logging.error(f"Response status: {e.response.status_code}")
                logging.error(f"Response content: {e.response.text}")
            raise Exception(f"Failed to create initiation rite transaction: {str(e)}")


    def create_task_request_transaction(self, transaction_data: dict) -> dict:
        """
        Create a task request transaction.
        
        Args:
            transaction_data: Dictionary containing:
                - account: The XRPL address of the user's wallet (sender)
                - destination: The XRPL address of the node (recipient)
                - request: The task request text
                - username: The discord username
                - task_id: A unique identifier for the task
                - amount: The amount to transfer (defaults to "1")
        
        Returns:
            dict: The unsigned transaction structure from the service
            
        Raises:
            Exception: If the request fails or returns an error status
        """
        # Create task record before making transaction
        self.task_storage.create_task(
            task_id=transaction_data["task_id"],
            wallet_address=transaction_data["account"],
            request=transaction_data["request"]
        )
        
        url = f"{self.base_url}/user/task-request-tx"
        
        logging.debug(f"Sending task request to: {url}")
        logging.debug(f"Transaction data: {transaction_data}")
        
        try:
            response = requests.post(url, json=transaction_data)
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") != "success":
                # Update task state to failed if transaction fails
                self.task_storage.update_task_state(
                    transaction_data["task_id"], 
                    TaskState.FAILED,
                    f"Transaction failed: {data.get('error', 'Unknown error')}"
                )
                raise Exception(f"Error from transaction service: {data.get('error', 'Unknown error')}")
                
            return data["transaction"]
            
        except requests.exceptions.RequestException as e:
            # Update task state to failed if request fails
            self.task_storage.update_task_state(
                transaction_data["task_id"], 
                TaskState.FAILED,
                f"Request failed: {str(e)}"
            )
            raise Exception(f"Failed to create task request transaction: {str(e)}")


    def create_task_refusal_transaction(self, transaction_data: dict) -> dict:
        """
        Create a task refusal transaction.
        
        Args:
            transaction_data: Dictionary containing:
                - account: The XRPL address of the user's wallet (sender)
                - destination: The XRPL address of the node (recipient)
                - refusal_reason: The reason for refusing the task
                - task_id: The ID of the task being refused
                - username: The discord username
                - amount: The amount to transfer (defaults to "1")
        
        Returns:
            dict: The unsigned transaction structure from the service
            
        Raises:
            Exception: If the request fails or returns an error status
        """
        url = f"{self.base_url}/user/task-refusal-tx"
        
        logging.debug(f"Sending task refusal request to: {url}")
        logging.debug(f"Transaction data: {transaction_data}")
        
        try:
            response = requests.post(url, json=transaction_data)
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") != "success":
                raise Exception(f"Error from transaction service: {data.get('error', 'Unknown error')}")
                
            return data["transaction"]
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to create task refusal transaction: {str(e)}")
            raise Exception(f"Failed to create task refusal transaction: {str(e)}")

    def create_task_completion_transaction(self, transaction_data: dict) -> dict:
        """
        Create a task completion transaction.
        
        Args:
            transaction_data: Dictionary containing:
                - account: The XRPL address of the user's wallet (sender)
                - destination: The XRPL address of the node (recipient)
                - completion_justification: Explanation of how the task was completed
                - task_id: The ID of the completed task
                - username: The discord username
                - amount: The amount to transfer (defaults to "1")
        
        Returns:
            dict: The unsigned transaction structure from the service
            
        Raises:
            Exception: If the request fails or returns an error status
        """
        url = f"{self.base_url}/user/task-completion-tx"
        
        logging.debug(f"Sending task completion request to: {url}")
        logging.debug(f"Transaction data: {transaction_data}")
        
        try:
            response = requests.post(url, json=transaction_data)
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") != "success":
                error_msg = data.get('error', 'Unknown error')
                logging.error(f"Transaction service error: {error_msg}")
                raise Exception(f"Error from transaction service: {error_msg}")
                
            return data["transaction"]
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to create task completion transaction: {str(e)}")
            logging.error(f"Request URL: {url}")
            logging.error(f"Request data: {transaction_data}")
            if hasattr(e, 'response') and e.response is not None:
                logging.error(f"Response status: {e.response.status_code}")
                logging.error(f"Response content: {e.response.text}")
            raise Exception(f"Failed to create task completion transaction: {str(e)}")

   

    def create_verification_response_transaction(self, transaction_data: dict) -> dict:
        """
        Create a verification response transaction from a user.
        
        Args:
            transaction_data: Dictionary containing:
                - account: The XRPL address of the user's wallet (sender)
                - destination: The XRPL address of the node (recipient)
                - verification_response: The detailed response to verification
                - task_id: The ID of the task being verified
                - username: The discord username
                - amount: The amount to transfer (defaults to "1")
        
        Returns:
            dict: The unsigned transaction structure from the service
            
        Raises:
            Exception: If the request fails or returns an error status
        """
        url = f"{self.base_url}/user/verification-response-tx"
        
        logging.debug(f"Sending verification response request to: {url}")
        logging.debug(f"Transaction data: {transaction_data}")
        
        try:
            response = requests.post(url, json=transaction_data)
            response.raise_for_status()
            
            data = response.json()
            if data.get("status") != "success":
                error_msg = data.get('error', 'Unknown error')
                logging.error(f"Transaction service error: {error_msg}")
                raise Exception(f"Error from transaction service: {error_msg}")
                
            return data["transaction"]
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to create verification response transaction: {str(e)}")
            logging.error(f"Request URL: {url}")
            logging.error(f"Request data: {transaction_data}")
            if hasattr(e, 'response') and e.response is not None:
                logging.error(f"Response status: {e.response.status_code}")
                logging.error(f"Response content: {e.response.text}")
            raise Exception(f"Failed to create verification response transaction: {str(e)}")
