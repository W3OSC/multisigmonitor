use super::schema::{
    Template, TemplateType, AssessmentTemplate,
};
use std::fs;
use std::path::Path;

pub struct TemplateLoader {
    transaction_templates: Vec<Template>,
    assessment_templates: Vec<AssessmentTemplate>,
}

impl TemplateLoader {
    pub fn new() -> Self {
        Self {
            transaction_templates: Vec::new(),
            assessment_templates: Vec::new(),
        }
    }

    pub fn load_from_directory<P: AsRef<Path>>(&mut self, base_path: P) -> Result<LoadStats, LoadError> {
        let base = base_path.as_ref();
        let mut stats = LoadStats::default();

        let tx_path = base.join("transaction-analysis");
        if tx_path.exists() {
            self.load_transaction_templates(&tx_path, &mut stats)?;
        }

        let assessment_path = base.join("safe-assessment");
        if assessment_path.exists() {
            self.load_assessment_templates(&assessment_path, &mut stats)?;
        }

        Ok(stats)
    }

    fn load_transaction_templates(&mut self, dir: &Path, stats: &mut LoadStats) -> Result<(), LoadError> {
        for entry in fs::read_dir(dir).map_err(|e| LoadError::IoError(e.to_string()))? {
            let entry = entry.map_err(|e| LoadError::IoError(e.to_string()))?;
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                match self.load_transaction_template(&path) {
                    Ok(template) => {
                        self.transaction_templates.push(template);
                        stats.transaction_loaded += 1;
                    }
                    Err(e) => {
                        stats.errors.push(format!("{}: {}", path.display(), e));
                    }
                }
            }
        }
        
        self.transaction_templates.sort_by_key(|t| t.builtin.is_some());
        
        Ok(())
    }

    fn load_assessment_templates(&mut self, dir: &Path, stats: &mut LoadStats) -> Result<(), LoadError> {
        for entry in fs::read_dir(dir).map_err(|e| LoadError::IoError(e.to_string()))? {
            let entry = entry.map_err(|e| LoadError::IoError(e.to_string()))?;
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                match self.load_assessment_template(&path) {
                    Ok(template) => {
                        self.assessment_templates.push(template);
                        stats.assessment_loaded += 1;
                    }
                    Err(e) => {
                        stats.errors.push(format!("{}: {}", path.display(), e));
                    }
                }
            }
        }
        Ok(())
    }

    fn load_transaction_template(&self, path: &Path) -> Result<Template, LoadError> {
        let content = fs::read_to_string(path)
            .map_err(|e| LoadError::IoError(e.to_string()))?;
        
        let template: Template = serde_yaml::from_str(&content)
            .map_err(|e| LoadError::ParseError(e.to_string()))?;

        self.validate_transaction_template(&template)?;
        
        Ok(template)
    }

    fn load_assessment_template(&self, path: &Path) -> Result<AssessmentTemplate, LoadError> {
        let content = fs::read_to_string(path)
            .map_err(|e| LoadError::IoError(e.to_string()))?;
        
        let template: AssessmentTemplate = serde_yaml::from_str(&content)
            .map_err(|e| LoadError::ParseError(e.to_string()))?;

        self.validate_assessment_template(&template)?;
        
        Ok(template)
    }

    fn validate_transaction_template(&self, template: &Template) -> Result<(), LoadError> {
        if template.id.is_empty() {
            return Err(LoadError::ValidationError("Template ID is required".to_string()));
        }
        if template.template_type != TemplateType::TransactionAnalysis {
            return Err(LoadError::ValidationError(
                format!("Expected transaction-analysis type, got {:?}", template.template_type)
            ));
        }
        if template.conditions.is_empty() && template.condition_groups.is_empty() && template.builtin.is_none() {
            return Err(LoadError::ValidationError(
                "Template must have conditions, condition-groups, or a builtin".to_string()
            ));
        }
        Ok(())
    }

    fn validate_assessment_template(&self, template: &AssessmentTemplate) -> Result<(), LoadError> {
        if template.id.is_empty() {
            return Err(LoadError::ValidationError("Template ID is required".to_string()));
        }
        if template.template_type != TemplateType::SafeAssessment {
            return Err(LoadError::ValidationError(
                format!("Expected safe-assessment type, got {:?}", template.template_type)
            ));
        }
        if template.conditions.is_empty() && template.validation_rules.is_empty() {
            return Err(LoadError::ValidationError(
                "Template must have conditions or validation-rules".to_string()
            ));
        }
        Ok(())
    }

    pub fn load_embedded_templates(&mut self) {
        self.transaction_templates = embedded_transaction_templates();
        self.assessment_templates = embedded_assessment_templates();
    }

    pub fn transaction_templates(&self) -> &[Template] {
        &self.transaction_templates
    }

    pub fn assessment_templates(&self) -> &[AssessmentTemplate] {
        &self.assessment_templates
    }

    pub fn get_transaction_template(&self, id: &str) -> Option<&Template> {
        self.transaction_templates.iter().find(|t| t.id == id)
    }

    pub fn get_assessment_template(&self, id: &str) -> Option<&AssessmentTemplate> {
        self.assessment_templates.iter().find(|t| t.id == id)
    }
}

impl Default for TemplateLoader {
    fn default() -> Self {
        let mut loader = Self::new();
        
        tracing::info!("TemplateLoader::default() initializing with embedded templates as authoritative source");
        
        let templates_path = std::path::Path::new("templates");
        
        if templates_path.exists() {
            match loader.load_from_directory(templates_path) {
                Ok(stats) => {
                    tracing::info!(
                        "Loaded {} transaction templates from files",
                        stats.transaction_loaded
                    );
                    if !stats.errors.is_empty() {
                        for error in &stats.errors {
                            tracing::warn!("Template load error: {}", error);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to load transaction templates: {}", e);
                }
            }
        }
        
        if loader.transaction_templates.is_empty() {
            tracing::info!("Loading embedded transaction templates as fallback");
            loader.transaction_templates = embedded_transaction_templates();
        }
        
        if loader.assessment_templates.is_empty() {
            tracing::info!("Loading embedded assessment templates as fallback");
            loader.assessment_templates = embedded_assessment_templates();
        }
        
        tracing::info!("TemplateLoader initialized with {} transaction templates and {} assessment templates",
            loader.transaction_templates.len(),
            loader.assessment_templates.len());
        
        if loader.assessment_templates.is_empty() {
            panic!("FATAL: No assessment templates loaded - cannot continue");
        }
        
        if loader.transaction_templates.is_empty() {
            panic!("FATAL: No transaction templates loaded - cannot continue");
        }
        
        loader
    }
}

#[derive(Debug, Default)]
pub struct LoadStats {
    pub transaction_loaded: usize,
    pub assessment_loaded: usize,
    pub errors: Vec<String>,
}

#[derive(Debug)]
pub enum LoadError {
    IoError(String),
    ParseError(String),
    ValidationError(String),
}

impl std::fmt::Display for LoadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LoadError::IoError(s) => write!(f, "IO error: {}", s),
            LoadError::ParseError(s) => write!(f, "Parse error: {}", s),
            LoadError::ValidationError(s) => write!(f, "Validation error: {}", s),
        }
    }
}

fn embedded_transaction_templates() -> Vec<Template> {
    vec![]
}

fn embedded_assessment_templates() -> Vec<AssessmentTemplate> {
    vec![]
}
