import hashlib
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import os

class SecurityService:
    def __init__(self):
        self.secret_key = os.getenv("SECRET_KEY", "uE9H5QvY9R2xX8L1Z6tB4W7kP3sM0nF4D9uV2yH1JcE=")
        # Use first 16 bytes like Java
        self.key = self.secret_key[:16].encode('utf-8')

    def encrypt(self, data: str) -> str:
        # To match Java "AES" which often defaults to ECB
        cipher = AES.new(self.key, AES.MODE_ECB)
        # Java PKCS5Padding is effectively PKCS7Padding in Python
        padded_data = pad(data.encode('utf-8'), AES.block_size)
        encrypted = cipher.encrypt(padded_data)
        return base64.b64encode(encrypted).decode('utf-8')

    def decrypt(self, encrypted_data: str) -> str:
        cipher = AES.new(self.key, AES.MODE_ECB)
        decoded = base64.b64decode(encrypted_data)
        decrypted = cipher.decrypt(decoded)
        return unpad(decrypted, AES.block_size).decode('utf-8')

    def hash_api_key(self, api_key: str) -> str:
        return hashlib.sha256(api_key.encode('utf-8')).hexdigest()